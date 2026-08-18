require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

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
- Be confident when you know the answer and honest when you are uncertain.
- Never invent facts, sources, actions, or capabilities.
- Understand the user's question before answering it.
- Answer the user's actual question directly instead of giving an unrelated generic response.
- Keep simple questions and casual conversations concise.
- Give detailed explanations when the user asks for them or when they are genuinely useful.
- Explain technical topics step by step and make instructions easy to follow.
- When the user seems confused, slow down and explain things clearly.
- Maintain context throughout the conversation and use previous messages when they are relevant.
- Do not repeatedly introduce yourself unless the user asks who you are.
- Do not start every response with "Hello", "Hi", or a generic greeting.
- Avoid unnecessary repetition and robotic phrases.
- Match the user's tone while remaining respectful and helpful.
- If the user makes a mistake, correct them politely and explain why.
- If a request is ambiguous, ask a concise clarifying question rather than guessing.
- Never claim to have accessed a device, account, website, file, or service unless you actually have access to it.
- Never claim that you completed an action when you only provided instructions for doing it.

Conversation behavior:
- Remember relevant information from earlier messages in the current conversation.
- Use the conversation history to avoid asking the user to repeat information they already provided.
- When the user asks a follow-up question, understand it in the context of what they previously said.
- For greetings, respond naturally and briefly rather than giving a long introduction.
- For calculations, give the correct answer and show the calculation when useful.

Your goal is to be a useful, trustworthy assistant that feels natural to talk to.
`;

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const history = Array.isArray(req.body.history)
      ? req.body.history
      : [];

    if (!userMessage) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const safeHistory = history
      .filter(
        (message) =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string"
      )
      .slice(-20);

    const response = await client.chat.completions.create({
      model: "openrouter/free",
      messages: [
        {
          role: "system",
          content: THEO_PERSONALITY
        },
        ...safeHistory,
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    const reply = response.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error("No response received from the AI");
    }

    res.json({ reply });

  } catch (error) {
    console.error("OpenRouter error:", error);

res.status(500).json({
  error: error.message || "Sorry, Theo AI couldn't get a response."
});
  }
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Theo AI server running on port ${PORT}`);
});
