require("dotenv").config();

const OpenAI = require("openai");
const { MODELS } = require("./models");

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://theo-ai-site.onrender.com",
    "X-Title": "Theo AI"
  }
});

module.exports = {
  client,
  MODELS
};
