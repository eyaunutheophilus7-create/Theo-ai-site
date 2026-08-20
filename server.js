require("dotenv").config();

const express = require("express");
const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const { client, MODELS } = require("./src/ai/client");
const { getModelForMessage, getFallbackModels } = require("./src/ai/router");

function cleanAIResponse(text) {
  if (typeof text !== "string") return text;

  const marker = "</thought>";
  const index = text.toLowerCase().indexOf(marker);

  if (index !== -1) {
    return text.slice(index + marker.length).trim();
  }

  return text.trim();
}

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
      CREATE TABLE IF NOT EXISTS memories (
      id BIGSERIAL PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      memory TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_memories_user
      ON memories(user_id);
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

async function saveMemoryIfUseful(userId, userMessage) {
  try {
    const existingMemoriesResult = await pool.query(
      `
      SELECT memory
      FROM memories
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 50
      `,
      [userId]
    );

    const existingMemories =
      existingMemoriesResult.rows
        .map((row) => `- ${row.memory}`)
        .join("\n");

    const memoryPrompt = `
You are Theo AI's memory manager.

Your job is to decide whether the user's latest message contains
a useful long-term fact about THE USER.

IMPORTANT:
- The user is NOT Theo.
- Theo is the AI assistant.
- Never describe the user as Theo.
- Always describe memories as facts about the user.

Useful memories include:
- The user's name or preferred name
- Personal preferences
- Favorite things
- Long-term projects
- Long-term goals
- Stable interests
- Useful personal instructions

Do NOT save:
- Passwords
- API keys
- Private keys
- Wallet seed phrases
- Financial credentials
- Temporary requests
- One-time information
- Sensitive personal information

Existing memories:

${existingMemories || "No memories yet."}

If the latest message contains a NEW useful fact that is not
already represented by an existing memory, return ONE short sentence
describing the fact about the user.

If it is already represented by an existing memory, return:
NONE

If there is nothing useful to remember, return:
NONE

User's latest message:
${userMessage}
`;

    const result = await client.chat.completions.create({
  model: MODELS.primary,
  messages: [
    {
      role: "system",
      content: memoryPrompt
    },
    {
      role: "user",
      content: "Analyze the user's latest message and decide whether it contains a useful long-term memory."
    }
  ]
});

    const memory =
      result.choices?.[0]?.message?.content?.trim();

    if (
      !memory ||
      memory.toUpperCase() === "NONE" ||
      memory.length < 3 ||
      memory.length > 500
    ) {
      return;
    }

    const existingMemory = await pool.query(
      `
      SELECT id
      FROM memories
      WHERE user_id = $1
        AND LOWER(memory) = LOWER($2)
      LIMIT 1
      `,
      [userId, memory]
    );

    if (existingMemory.rows.length > 0) {
      console.log(
        "Duplicate memory skipped:",
        memory
      );
      return;
    }

    await pool.query(
      `
      INSERT INTO memories
      (user_id, memory)
      VALUES ($1, $2)
      `,
      [userId, memory]
    );

    console.log(
      "Long-term memory saved:",
      memory
    );

  } catch (error) {
    console.error(
      "Automatic memory error:",
      error
    );
  }
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

    if (role === "user") {
      await pool.query(
        `
        UPDATE conversations
        SET
          title = CASE
            WHEN title IS NULL
              OR title = ''
              OR title = 'New Chat'
              OR title = 'New conversation'
            THEN LEFT(
              REGEXP_REPLACE(TRIM($1), '\\s+', ' ', 'g'),
              80
            )
            ELSE title
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND user_id = $3
        `,
        [content, conversationId, userId]
      );
    } else {
      await pool.query(
        `
        UPDATE conversations
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2
        `,
        [conversationId, userId]
      );
    }

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
  Save a long-term memory
*/
app.post("/api/memories", async (req, res) => {
  try {
    const {
      userId,
      memory
    } = req.body;

    if (!userId || !memory) {
      return res.status(400).json({
        error: "User ID and memory are required"
      });
    }

    await pool.query(
      `
      INSERT INTO memories
      (user_id, memory)
      VALUES ($1, $2)
      `,
      [
        String(userId).trim(),
        String(memory).trim()
      ]
    );

    res.json({
      success: true
    });

  } catch (error) {
    console.error("Save memory error:", error);

    res.status(500).json({
      error: "Could not save memory"
    });
  }
});

/*
  Get long-term memories
*/
app.get("/api/memories/:userId", async (req, res) => {
  try {
    const userId = String(
      req.params.userId || ""
    ).trim();

    if (!userId) {
      return res.status(400).json({
        error: "User ID is required"
      });
    }

    const result = await pool.query(
      `
      SELECT id, memory, created_at, updated_at
      FROM memories
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 100
      `,
      [userId]
    );

    res.json({
      memories: result.rows
    });

  } catch (error) {
    console.error("Get memories error:", error);

    res.status(500).json({
      error: "Could not load memories"
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
      FROM conversations c
      WHERE c.user_id = $1
        AND EXISTS (
          SELECT 1
          FROM messages m
          WHERE m.conversation_id = c.id
            AND m.user_id = c.user_id
        )
      ORDER BY c.updated_at DESC
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

    // Automatically set the conversation title from the first user message
    await pool.query(
      `
      UPDATE conversations
      SET
        title = CASE
          WHEN title IS NULL
            OR title = ''
            OR title = 'New Chat'
            OR title = 'New conversation'
          THEN LEFT(
            REGEXP_REPLACE(TRIM($1), '\\s+', ' ', 'g'),
            80
          )
          ELSE title
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND user_id = $3
      `,
      [userMessage, conversationId, userId]
    );

    /*
      Automatically extract useful long-term memories
    */
    await saveMemoryIfUseful(
      userId,
      userMessage
    );

    /*
  Detect whether the user may need information
  from a previous conversation.
*/
const recallRequest =
  /\b(recall|remember|remembered|previous|earlier|before|last|old|past|history|conversation|chat|talked|discussed|mentioned|told|said|project|what did|where did|how did|when did|you know|you remember|we discussed|we talked)\b/i
    .test(userMessage);

    let recallContext = "";

    /*
      Load long-term memories
    */
    let memoryContext = "";

    const memoryResult = await pool.query(
      `
      SELECT memory
      FROM memories
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 20
      `,
      [userId]
    );

    if (memoryResult.rows.length > 0) {
      memoryContext = `
LONG-TERM MEMORY ABOUT THE USER:

${memoryResult.rows
  .map((row) => `- ${row.memory}`)
  .join("\n")}

END LONG-TERM MEMORY.
`;
    }

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

    const routeInfo = getModelForMessage(userMessage);
    const modelsToTry = getFallbackModels(routeInfo.route);

    let response = null;
    let selectedModel = null;
    let lastModelError = null;

    for (const model of modelsToTry) {
      try {
        console.log(
          `Theo AI trying model: ${model} (route: ${routeInfo.route})`
        );

        response = await client.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content:
                THEO_PERSONALITY +
                "\n\n" +
                memoryContext +
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

        selectedModel = model;

        console.log(
          `Theo AI response generated by: ${selectedModel}`
        );

        break;

      } catch (error) {
        lastModelError = error;

        console.error(
          `Model failed: ${model}`,
          error?.message || error
        );
      }
    }

    if (!response) {
      throw lastModelError || new Error("All AI models failed");
    }

    const rawReply =
      response.choices?.[0]?.message?.content;

    const reply = cleanAIResponse(rawReply);

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


/*
 * THEO_LIVE_SERVER_V1
 * Gemini Live voice server.
 * GEMINI_API_KEY remains server-side.
 */

const liveWss = new WebSocketServer({
  noServer: true
});

const LIVE_MODELS = [
  "gemini-2.5-flash-native-audio-latest",
  "gemini-3.1-flash-live-preview"
];

liveWss.on("connection", async (browserSocket) => {
  let geminiSession = null;
  let isClosed = false;

  const sendBrowser = (payload) => {
    if (browserSocket.readyState === WebSocket.OPEN) {
      browserSocket.send(JSON.stringify(payload));
    }
  };

  try {
    const { GoogleGenAI, Modality } = require("@google/genai");

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    let lastError = null;

    for (const model of LIVE_MODELS) {
      try {
        console.log(`Theo Live trying model: ${model}`);

        geminiSession = await ai.live.connect({
          model,
          config: {
            responseModalities: [Modality.AUDIO]
          },
          callbacks: {
            onopen: () => {
              console.log(`Theo Live connected: ${model}`);

              sendBrowser({
                type: "live_connected",
                model
              });
            },

            onmessage: (message) => {
              sendBrowser({
                type: "live_message",
                data: message
              });
            },

            onerror: (error) => {
              console.error(
                "Theo Live error:",
                error?.message || error
              );

              sendBrowser({
                type: "live_error",
                error:
                  error?.message ||
                  "Live connection error"
              });
            },

            onclose: () => {
              console.log(`Theo Live closed: ${model}`);

              if (!isClosed) {
                sendBrowser({
                  type: "live_closed"
                });
              }
            }
          }
        });

        lastError = null;
        break;
      } catch (error) {
        lastError = error;

        console.error(
          `Theo Live model failed: ${model}`,
          error?.message || error
        );
      }
    }

    if (!geminiSession) {
      throw (
        lastError ||
        new Error("All Live models failed")
      );
    }

    browserSocket.on("message", (raw) => {
      if (!geminiSession) return;

      try {
        const message = JSON.parse(raw.toString());

        if (message.type === "client_content") {
          geminiSession.sendClientContent(message.data);
          return;
        }

        if (message.type === "realtime_input") {
          geminiSession.sendRealtimeInput(message.data);
          return;
        }

        if (message.type === "audio_stream_end") {
          geminiSession.sendRealtimeInput({
            audioStreamEnd: true
          });
        }
      } catch (error) {
        console.error(
          "Theo Live browser message error:",
          error?.message || error
        );
      }
    });

    browserSocket.on("close", () => {
      isClosed = true;

      try {
        geminiSession?.close();
      } catch (_) {}

      console.log(
        "Theo Live browser connection closed"
      );
    });

  } catch (error) {
    console.error(
      "Theo Live startup error:",
      error?.message || error
    );

    sendBrowser({
      type: "live_error",
      error:
        error?.message ||
        "Unable to start Live voice"
    });

    try {
      browserSocket.close();
    } catch (_) {}
  }
});

httpServer.on("upgrade", (request, socket, head) => {
  if (request.url !== "/api/live") {
    socket.destroy();
    return;
  }

  liveWss.handleUpgrade(
    request,
    socket,
    head,
    (ws) => {
      liveWss.emit(
        "connection",
        ws,
        request
      );
    }
  );
});

console.log(
  "Theo Live server ready at /api/live"
);


httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Theo AI server running on port ${PORT}`
  );
});
