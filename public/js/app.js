const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const chat = document.getElementById("chat");
const sendButton = document.getElementById("send-button");
const newChatButton = document.getElementById("new-chat");

const conversationPanel =
  document.getElementById("conversation-panel");

const conversationList =
  document.getElementById("conversation-list");

const closeHistoryButton =
  document.getElementById("close-history");

let conversationHistory = [];

let userId =
  localStorage.getItem("theo_user_id");

let conversationId =
  localStorage.getItem("theo_conversation_id");


/*
  Create a new conversation
*/
async function createConversation() {
  const response = await fetch(
    "/api/conversations",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Could not create conversation"
    );
  }

  conversationId =
    data.conversationId;

  localStorage.setItem(
    "theo_conversation_id",
    conversationId
  );

  conversationHistory = [];

  return conversationId;
}


/*
  Load messages from current conversation
*/
async function loadConversationHistory() {
  if (!userId || !conversationId) {
    return;
  }

  const response = await fetch(
    `/api/messages/${encodeURIComponent(userId)}/${encodeURIComponent(conversationId)}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Could not load conversation"
    );
  }

  conversationHistory =
    (data.messages || [])
      .filter(
        message =>
          message.role === "user" ||
          message.role === "assistant"
      )
      .map(message => ({
        role: message.role,
        content: message.content
      }))
      .slice(-20);

  chat.innerHTML = "";

  if (
    conversationHistory.length === 0
  ) {
    showWelcome();
    return;
  }

  conversationHistory.forEach(
    message => {
      addMessage(
        message.content,
        message.role
      );
    }
  );
}


/*
  Load all previous conversations
*/
async function loadConversations() {
  if (!userId) {
    return;
  }

  try {
    conversationList.innerHTML = `
      <div class="conversation-loading">
        Loading conversations...
      </div>
    `;

    const response = await fetch(
      `/api/conversations/${encodeURIComponent(userId)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Could not load conversations"
      );
    }

    const conversations =
      data.conversations || [];

    conversationList.innerHTML = "";

    if (conversations.length === 0) {
      conversationList.innerHTML = `
        <div class="conversation-empty">
          No previous chats yet.
        </div>
      `;

      return;
    }

    conversations.forEach(
      conversation => {

        const button =
          document.createElement("button");

        button.type = "button";

        button.className =
          "conversation-item";

        if (
          conversation.id ===
          conversationId
        ) {
          button.classList.add(
            "active"
          );
        }

        const title =
          document.createElement("div");

        title.className =
          "conversation-title";

        title.textContent =
          conversation.title &&
          conversation.title !== "New Chat"
            ? conversation.title
            : "New Chat";

        const date =
          document.createElement("div");

        date.className =
          "conversation-date";

        date.textContent =
          formatConversationDate(
            conversation.updated_at ||
            conversation.created_at
          );

        button.appendChild(title);
        button.appendChild(date);

        button.addEventListener(
          "click",
          async () => {

            await openConversation(
              conversation.id
            );

          }
        );

        conversationList.appendChild(
          button
        );
      }
    );

  } catch (error) {

    console.error(
      "Conversation history error:",
      error
    );

    conversationList.innerHTML = `
      <div class="conversation-empty">
        Could not load previous chats.
      </div>
    `;
  }
}


/*
  Open an existing conversation
*/
async function openConversation(
  selectedConversationId
) {
  try {

    conversationId =
      selectedConversationId;

    localStorage.setItem(
      "theo_conversation_id",
      conversationId
    );

    conversationHistory = [];

    await loadConversationHistory();

    closeConversationPanel();

    await loadConversations();

    input.focus();

  } catch (error) {

    console.error(
      "Open conversation error:",
      error
    );

    alert(
      "Could not open this conversation."
    );
  }
}


/*
  Format conversation date
*/
function formatConversationDate(
  dateString
) {
  if (!dateString) {
    return "";
  }

  const date =
    new Date(dateString);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }
  );
}


/*
  Open conversation sidebar
*/
function openConversationPanel() {

  conversationPanel.classList.add(
    "open"
  );

  loadConversations();
}


/*
  Close conversation sidebar
*/
function closeConversationPanel() {

  conversationPanel.classList.remove(
    "open"
  );
}


/*
  Initialize user
*/
async function initializeUser() {

  if (!userId) {

    userId =
      crypto.randomUUID();

    localStorage.setItem(
      "theo_user_id",
      userId
    );
  }

  if (!conversationId) {

    await createConversation();
  }

  await loadConversationHistory();

  await loadConversations();
}


/*
  Send message
*/
form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const message =
      input.value.trim();

    if (!message) {
      return;
    }

    addMessage(
      message,
      "user"
    );

    input.value = "";

    input.focus();

    sendButton.disabled = true;

    const thinking =
      addTypingIndicator();

    try {

      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              message,
              history:
                conversationHistory,
              userId,
              conversationId
            })
          }
        );

      const text =
        await response.text();

      let data;

      try {

        data =
          JSON.parse(text);

      } catch {

        throw new Error(
          "Server returned invalid JSON"
        );
      }

      if (!response.ok) {

        throw new Error(
          data.error ||
          "Request failed"
        );
      }

      thinking.remove();

      addMessage(
        data.reply,
        "assistant"
      );

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

      /*
        Refresh conversation list
        so the latest chat appears
        at the top.
      */
      await loadConversations();

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

      sendButton.disabled =
        false;

      input.focus();
    }
  }
);


/*
  New Chat button
*/
newChatButton.addEventListener(
  "click",
  async () => {

    try {

      await createConversation();

      showWelcome();

      await loadConversations();

      /*
        Open history so the user
        can immediately see previous chats.
      */
      openConversationPanel();

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


/*
  Close sidebar
*/
closeHistoryButton.addEventListener(
  "click",
  () => {
    closeConversationPanel();
    input.focus();
  }
);


/*
  Show welcome screen
*/
function showWelcome() {

  chat.innerHTML = `
    <div class="welcome">

      <div class="welcome-avatar">
        T
      </div>

      <h2>
        Hello, I'm Theo 👋
      </h2>

      <p>
        Your personal AI assistant.
        Ask me anything and let's get started.
      </p>

    </div>

    <div class="message assistant">

      <div class="bubble">
        What would you like to talk about?
      </div>

    </div>
  `;
}


/*
  Add chat message
*/
function addMessage(
  text,
  sender
) {

  const message =
    document.createElement("div");

  message.className =
    `message ${sender}`;

  const bubble =
    document.createElement("div");

  bubble.className =
    "bubble";

  bubble.textContent =
    text;

  message.appendChild(
    bubble
  );

  chat.appendChild(
    message
  );

  chat.scrollTop =
    chat.scrollHeight;

  return message;
}


/*
  Typing indicator
*/
function addTypingIndicator() {

  const message =
    document.createElement("div");

  message.className =
    "message assistant typing";

  const bubble =
    document.createElement("div");

  bubble.className =
    "bubble";

  for (
    let i = 0;
    i < 3;
    i++
  ) {

    const dot =
      document.createElement("span");

    dot.className =
      "typing-dot";

    bubble.appendChild(
      dot
    );
  }

  message.appendChild(
    bubble
  );

  chat.appendChild(
    message
  );

  chat.scrollTop =
    chat.scrollHeight;

  return message;
}


/*
  Start Theo
*/
initializeUser().catch(
  error => {

    console.error(
      "Initialization error:",
      error
    );
  }
);
