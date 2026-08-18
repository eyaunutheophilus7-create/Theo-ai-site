require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");

const app = express();
const PORT = 3000;

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Theo AI"
  }
});

app.use(express.json());
app.use(express.static("public"));

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const response = await client.chat.completions.create({
      model: "openrouter/free",
      messages: [
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
      error: "Sorry, Theo AI couldn't get a response."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Theo AI is running on http://localhost:${PORT}`);
});
