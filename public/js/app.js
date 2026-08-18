const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const chat = document.getElementById("chat");
const sendButton = document.getElementById("send-button");
const newChatButton = document.getElementById("new-chat");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = input.value.trim();

  if (!message) return;

  addMessage(message, "user");

  input.value = "";
  input.focus();

  sendButton.disabled = true;

  const thinking = addTypingIndicator();

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
      throw new Error("Server returned invalid JSON");
    }

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    thinking.remove();

    addMessage(data.reply, "assistant");

  } catch (error) {
    thinking.remove();

    addMessage(
      "Sorry, something went wrong: " + error.message,
      "assistant"
    );

    console.error("Chat error:", error);

  } finally {
    sendButton.disabled = false;
    input.focus();
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


function addTypingIndicator() {
  const message = document.createElement("div");
  message.className = "message assistant typing";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
    dot.className = "typing-dot";
    bubble.appendChild(dot);
  }

  message.appendChild(bubble);
  chat.appendChild(message);

  chat.scrollTop = chat.scrollHeight;

  return message;
}


newChatButton.addEventListener("click", () => {
  chat.innerHTML = `
    <div class="welcome">
      <div class="welcome-avatar">T</div>

      <h2>Hello, I'm Theo 👋</h2>

      <p>
        Your personal AI assistant. Ask me anything and let's get started.
      </p>
    </div>

    <div class="message assistant">
      <div class="bubble">
        What would you like to talk about?
      </div>
    </div>
  `;

  input.focus();
});
