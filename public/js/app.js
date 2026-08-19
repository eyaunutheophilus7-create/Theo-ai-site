const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const chat = document.getElementById("chat");
const sendButton = document.getElementById("send-button");

const newChatButton = document.getElementById("new-chat");
const sidebarNewChatButton =
  document.getElementById("sidebar-new-chat");

const conversationList =
  document.getElementById("conversation-list");

const sidebar =
  document.getElementById("sidebar");

const menuButton =
  document.getElementById("menu-button");

const closeSidebarButton =
  document.getElementById("close-sidebar");

const sidebarOverlay =
  document.getElementById("sidebar-overlay");

let conversationHistory = [];

let userId =
  localStorage.getItem("theo_user_id");

let conversationId =
  localStorage.getItem("theo_conversation_id");


/*
  =========================
  SIDEBAR
  =========================
*/

function openSidebar() {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("open");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("open");
}

if (menuButton) {
  menuButton.addEventListener(
    "click",
    openSidebar
  );
}

if (closeSidebarButton) {
  closeSidebarButton.addEventListener(
    "click",
    closeSidebar
  );
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener(
    "click",
    closeSidebar
  );
}


/*
  Load previous conversations
*/
async function loadConversations() {
  if (!userId) return;

  try {
    const response = await fetch(
      `/api/conversations/${userId}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Could not load conversations"
      );
    }

    conversationList.innerHTML = "";

    const conversations =
      data.conversations || [];

    if (conversations.length === 0) {
      conversationList.innerHTML = `
        <div class="history-empty">
          No previous chats yet.
        </div>
      `;

      return;
    }

    conversations.forEach(
      (conversation) => {

        const button =
          document.createElement("button");

        button.type = "button";

        button.className =
          "conversation-item";

        if (
          conversation.id ===
          conversationId
        ) {
          button.classList.add("active");
        }

        const title =
          document.createElement("div");

        title.className =
          "conversation-title";

        title.textContent =
          conversation.title ||
          "New Chat";

        const date =
          document.createElement("div");

        date.className =
          "conversation-date";

        date.textContent =
          formatConversationDate(
            conversation.updated_at
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

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  );
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

    await loadConversationHistory();

    await loadConversations();

    closeSidebar();

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
  =========================
  CREATE CONVERSATION
  =========================
*/

async function createConversation() {

  const response =
    await fetch(
      "/api/conversations",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          userId
        })
      }
    );

  const data =
    await response.json();

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

  await loadConversations();
}


/*
  =========================
  LOAD CURRENT CHAT
  =========================
*/

async function loadConversationHistory() {

  if (
    !userId ||
    !conversationId
  ) {
    return;
  }

  const response =
    await fetch(
      `/api/messages/${userId}/${conversationId}`
    );

  const data =
    await response.json();

  if (!response.ok) {

    throw new Error(
      data.error ||
      "Could not load conversation"
    );

  }

  conversationHistory =
    (data.messages || [])
      .filter(
        (message) =>
          message.role === "user" ||
          message.role === "assistant"
      )
      .map(
        (message) => ({
          role: message.role,
          content: message.content
        })
      )
      .slice(-20);

  chat.innerHTML = "";

  if (
    conversationHistory.length === 0
  ) {

    showWelcome();

    return;
  }

  conversationHistory.forEach(
    (message) => {

      addMessage(
        message.content,
        message.role
      );

    }
  );
}


/*
  =========================
  INITIALIZE USER
  =========================
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
  =========================
  SEND MESSAGE
  =========================
*/

form.addEventListener(
  "submit",
  async (event) => {

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
        so the latest chat appears.
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

      sendButton.disabled = false;

      input.focus();

    }

  }
);


/*
  =========================
  NEW CHAT
  =========================
*/

async function startNewChat() {

  try {

    await createConversation();

    showWelcome();

    await loadConversations();

    closeSidebar();

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


if (newChatButton) {

  newChatButton.addEventListener(
    "click",
    startNewChat
  );

}


if (sidebarNewChatButton) {

  sidebarNewChatButton.addEventListener(
    "click",
    startNewChat
  );

}


/*
  =========================
  WELCOME
  =========================
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
  =========================
  ADD MESSAGE
  =========================
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
  =========================
  TYPING INDICATOR
  =========================
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
  =========================
  START THE APP
  =========================
*/

initializeUser().catch(
  (error) => {

    console.error(
      "Initialization error:",
      error
    );

  }
);
