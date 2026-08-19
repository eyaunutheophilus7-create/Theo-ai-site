require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://theo-ai-site.onrender.com",
    "X-Title": "Theo AI"
  }
});

app.use(express.json());
app.use(express.static("public"));

const THEO_PERSONALITY = `
You are Theo AI, a friendly, intelligent, natural, and trustworthy AI assistant.

Your personality:
- Speak naturally, like a thoughtful human assistant.
- Be warm, respectful, and approachable.
- Be confident when you know the answer and honest when uncertain.
- Never invent facts, sources, actions, or capabilities.
- Answer the user's actual question directly.
- Keep simple questions concise.
- Give detailed explanations when useful.
- Explain technical topics step by step.
- Maintain context throughout the current conversation.
- Match the user's tone while remaining respectful.
- If the user makes a mistake, correct them politely.
- If a request is ambiguous, ask a concise clarifying question.
- Never claim to have accessed something unless you actually have access.

Recall behavior:
- You may receive RECALL CONTEXT containing information from previous conversations.
- Use it when it is relevant to the user's question.
- Do not pretend to remember something that is not present in the supplied recall context.
- If the recall context is relevant, naturally acknowledge it.
- If there is no relevant recall context, answer normally.
`;

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      title TEXT DEFAULT 'New Chat',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id VARCHAR(100) NOT NULL,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_user
      ON conversations(user_id);

    CREATE INDEX IF NOT EXISTS idx_messages_user
      ON messages(user_id);

    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id);
  `);

  console.log("Recall database tables ready");
}

initializeDatabase()
  .then(() => {
    console.log("PostgreSQL database connected");
  })
  .catch((error) => {
    console.error("Database initialization error:", error);
  });

function createId() {
  return crypto.randomUUID();
}

/*
  Create a new conversation
*/
app.post("/api/conversations", async (req, res) => {
  try {
    const userId = String(req.body.userId || "").trim();

    if (!userId) {
      return res.status(400).json({
        error: "User ID is required"
      });
    }

    const conversationId = createId();

    await pool.query(
      `
      INSERT INTO conversations (id, user_id)
      VALUES ($1, $2)
      `,
      [conversationId, userId]
    );

    res.json({
      conversationId
    });

  } catch (error) {
    console.error("Create conversation error:", error);

    res.status(500).json({
      error: "Could not create conversation"
    });
  }
});

/*
  Save a message
*/
app.post("/api/messages", async (req, res) => {
  try {
    const {
      userId,
      conversationId,
      role,
      content
    } = req.body;

    if (!userId || !conversationId || !content) {
      return res.status(400).json({
        error: "Missing message information"
      });
    }

    if (!["user", "assistant"].includes(role)) {
      return res.status(400).json({
        error: "Invalid message role"
      });
    }

    await pool.query(
      `
      INSERT INTO messages
      (conversation_id, user_id, role, content)
      VALUES ($1, $2, $3, $4)
      `,
      [conversationId, userId, role, content]
    );

    await pool.query(
      `
      UPDATE conversations
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      `,
      [conversationId, userId]
    );

    res.json({
      success: true
    });

  } catch (error) {
    console.error("Save message error:", error);

    res.status(500).json({
      error: "Could not save message"
    });
  }
});

/*
  Recall previous conversations
*/
app.post("/api/recall", async (req, res) => {
  try {
    const {
      userId,
      query
    } = req.body;

    if (!userId || !query) {
      return res.status(400).json({
        error: "User ID and query are required"
      });
    }

    const result = await pool.query(
      `
      SELECT
        c.id AS conversation_id,
        c.title,
        m.role,
        m.content,
        m.created_at
      FROM messages m
      JOIN conversations c
        ON c.id = m.conversation_id
      WHERE m.user_id = $1
        AND (
          m.content ILIKE '%' || $2 || '%'
          OR c.title ILIKE '%' || $2 || '%'
        )
      ORDER BY m.created_at DESC
      LIMIT 30
      `,
      [userId, query]
    );

    res.json({
      results: result.rows
    });

  } catch (error) {
    console.error("Recall error:", error);

    res.status(500).json({
      error: "Could not search previous conversations"
    });
  }
});
/*
  Get messages from one conversation
*/
app.get("/api/messages/:userId/:conversationId", async (req, res) => {
  try {
    const {
      userId,
      conversationId
    } = req.params;

    const result = await pool.query(
      `
      SELECT id, role, content, created_at
      FROM messages
      WHERE user_id = $1
        AND conversation_id = $2
      ORDER BY created_at ASC
      `,
      [userId, conversationId]
    );

    res.json({
      messages: result.rows
    });

  } catch (error) {
    console.error("Message history error:", error);

    res.status(500).json({
      error: "Could not load conversation messages"
    });
  }
});

/*
  Get conversation history
*/
app.get("/api/conversations/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const result = await pool.query(
      `
      SELECT id, title, created_at, updated_at
      FROM conversations
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 50
      `,
      [userId]
    );

    res.json({
      conversations: result.rows
    });

  } catch (error) {
    console.error("Conversation list error:", error);

    res.status(500).json({
      error: "Could not load conversations"
    });
  }
});

/*
  Main AI chat endpoint
*/
app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = String(req.body.message || "").trim();

    const history = Array.isArray(req.body.history)
      ? req.body.history
      : [];

    const userId = String(req.body.userId || "").trim();

    const conversationId = String(
      req.body.conversationId || ""
    ).trim();

    if (!userMessage) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    if (!userId || !conversationId) {
      return res.status(400).json({
        error: "User session is required"
      });
    }

    /*
      Save user message
    */
    await pool.query(
      `
      INSERT INTO messages
      (conversation_id, user_id, role, content)
      VALUES ($1, $2, 'user', $3)
      `,
      [conversationId, userId, userMessage]
    );

    /*
      Detect whether the user is asking Theo to recall something.
    */
    const recallRequest =
      /\b(recall|remember|previous|earlier|before|last chat|last conversation|old conversation|what did we talk about|we talked about|you remember)\b/i
        .test(userMessage);

    let recallContext = "";

    if (recallRequest) {
      const recallResult = await pool.query(
        `
        SELECT
          c.title,
          m.role,
          m.content,
          m.created_at
        FROM messages m
        JOIN conversations c
          ON c.id = m.conversation_id
        WHERE m.user_id = $1
          AND m.conversation_id != $2
        ORDER BY m.created_at DESC
        LIMIT 40
        `,
        [userId, conversationId]
      );

      if (recallResult.rows.length > 0) {
        recallContext = `
RECALL CONTEXT FROM PREVIOUS CONVERSATIONS:

${recallResult.rows
  .reverse()
  .map(
    (row) =>
      `[${row.created_at}] ${row.role}: ${row.content}`
  )
  .join("\n")}

END RECALL CONTEXT.
`;
      }
    }

    const safeHistory = history
      .filter(
        (message) =>
          message &&
          (message.role === "user" ||
            message.role === "assistant") &&
          typeof message.content === "string"
      )
      .slice(-20);

    const response = await client.chat.completions.create({
      model: "openrouter/free",
      messages: [
        {
          role: "system",
          content:
            THEO_PERSONALITY +
            "\n\n" +
            recallContext
        },
        ...safeHistory,
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    const reply =
      response.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error(
        "No response received from the AI"
      );
    }

    /*
      Save Theo's response
    */
    await pool.query(
      `
      INSERT INTO messages
      (conversation_id, user_id, role, content)
      VALUES ($1, $2, 'assistant', $3)
      `,
      [conversationId, userId, reply]
    );

    await pool.query(
      `
      UPDATE conversations
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      `,
      [conversationId, userId]
    );

    res.json({
      reply
    });

  } catch (error) {
    console.error("OpenRouter error:", error);

    res.status(500).json({
      error:
        error.message ||
        "Sorry, Theo AI couldn't get a response."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Theo AI server running on port ${PORT}`
  );
});
