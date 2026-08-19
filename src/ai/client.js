require("dotenv").config();

const OpenAI = require("openai");
const { MODELS } = require("./models");

const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});
