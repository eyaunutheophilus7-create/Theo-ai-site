const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const chat = document.getElementById("chat");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = input.value.trim();

  if (!message) return;

  addMessage(message, "user");
  input.value = "";

  const thinking = addMessage("Thinking...", "assistant");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message
      })
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Server returned invalid JSON: " + text);
    }

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    thinking.remove();

    addMessage(data.reply, "assistant");

  } catch (error) {
    thinking.remove();

    addMessage(
      "Error: " + error.message,
      "assistant"
    );

    console.error("Chat error:", error);
  }
});

function addMessage(text, sender) {
  const message = document.createElement("div");
  message.className = `message ${sender}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  message.appendChild(bubble);
  chat.appendChild(message);

  chat.scrollTop = chat.scrollHeight;

  return message;
}
