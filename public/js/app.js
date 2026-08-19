const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const chat = document.getElementById("chat");
const sendButton = document.getElementById("send-button");
const newChatButton = document.getElementById("new-chat");

let conversationHistory = [];

let userId = localStorage.getItem("theo_user_id");
let conversationId = localStorage.getItem("theo_conversation_id");

async function createConversation() {
  const response = await fetch("/api/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Could not create conversation"
    );
  }

  conversationId = data.conversationId;

  localStorage.setItem(
    "theo_conversation_id",
    conversationId
  );

  conversationHistory = [];
}

async function loadConversationHistory() {
  if (!userId || !conversationId) {
    return;
  }

  const response = await fetch(
    `/api/messages/${userId}/${conversationId}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Could not load conversation"
    );
  }

  conversationHistory = data.messages
    .filter(
      (message) =>
        message.role === "user" ||
        message.role === "assistant"
    )
    .map((message) => ({
      role: message.role,
      content: message.content
    }))
    .slice(-20);

  chat.innerHTML = "";

  if (conversationHistory.length === 0) {
    showWelcome();
    return;
  }

  conversationHistory.forEach((message) => {
    addMessage(
      message.content,
      message.role
    );
  });
}

async function initializeUser() {
  if (!userId) {
    userId = crypto.randomUUID();

    localStorage.setItem(
      "theo_user_id",
      userId
    );
  }

  if (!conversationId) {
    await createConversation();
  }

  await loadConversationHistory();
}

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
        message,
        history: conversationHistory,
        userId,
        conversationId
      })
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        "Server returned invalid JSON"
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error || "Request failed"
      );
    }

    thinking.remove();

    addMessage(data.reply, "assistant");

    conversationHistory.push(
      {
        role: "user",
        content: message
      },
      {
        role: "assistant",
        content: data.reply
      }
    );

    conversationHistory =
      conversationHistory.slice(-20);

  } catch (error) {
    thinking.remove();

    addMessage(
      "Sorry, something went wrong: " +
        error.message,
      "assistant"
    );

    console.error(
      "Chat error:",
      error
    );

  } finally {
    sendButton.disabled = false;
    input.focus();
  }
});

newChatButton.addEventListener(
  "click",
  async () => {
    try {
      await createConversation();

      showWelcome();

      input.focus();

    } catch (error) {
      console.error(
        "New chat error:",
        error
      );

      alert(
        "Could not start a new conversation."
      );
    }
  }
);

function showWelcome() {
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
}

function addMessage(text, sender) {
  const message =
    document.createElement("div");

  message.className =
    `message ${sender}`;

  const bubble =
    document.createElement("div");

  bubble.className = "bubble";

  bubble.textContent = text;

  message.appendChild(bubble);

  chat.appendChild(message);

  chat.scrollTop =
    chat.scrollHeight;

  return message;
}

function addTypingIndicator() {
  const message =
    document.createElement("div");

  message.className =
    "message assistant typing";

  const bubble =
    document.createElement("div");

  bubble.className = "bubble";

  for (let i = 0; i < 3; i++) {
    const dot =
      document.createElement("span");

    dot.className =
      "typing-dot";

    bubble.appendChild(dot);
  }

  message.appendChild(bubble);

  chat.appendChild(message);

  chat.scrollTop =
    chat.scrollHeight;

  return message;
}

initializeUser().catch((error) => {
  console.error(
    "Initialization error:",
    error
  );
});
