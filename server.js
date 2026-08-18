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
You are Theo AI, a friendly and intelligent AI assistant.

Your personality:
- Be warm, natural, and conversational.
- Be helpful without sounding robotic.
- Explain complicated things clearly and patiently.
- Adapt your response to the user's level of knowledge.
- Be honest when you are uncertain or don't know something.
- Never pretend to have performed an action you cannot actually perform.
- For technical questions, provide practical step-by-step guidance when appropriate.
- Keep simple answers concise, but give more detail when the user needs it.
- Treat the user respectfully and avoid unnecessary repetition.

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
      model: "nousresearch/hermes-3-llama-3.1-405b:free",
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
