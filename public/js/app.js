const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const chat = document.getElementById("chat");
const sendButton = document.getElementById("send-button");

const historySidebar = document.getElementById("history-sidebar");
const historyOverlay = document.getElementById("history-overlay");
const openHistoryButton = document.getElementById("open-history");
const closeHistoryButton = document.getElementById("close-history");
const historyNewChatButton = document.getElementById("history-new-chat");
const conversationSearch = document.getElementById("conversation-search");
const conversationList = document.getElementById("conversation-list");

const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const themeText = document.getElementById("theme-text");

let conversationHistory = [];
let conversations = [];

let userId = localStorage.getItem("theo_user_id");
let conversationId = localStorage.getItem("theo_conversation_id");

let lastUserMessage = "";


/* =========================================================
   THEME
========================================================= */

function applyTheme(theme) {
  if (theme === "light") {
    document.body.classList.add("light-theme");

    themeIcon.textContent = "🌙";
    themeText.textContent = "Dark mode";
  } else {
    document.body.classList.remove("light-theme");

    themeIcon.textContent = "☀️";
    themeText.textContent = "Light mode";
  }

  localStorage.setItem("theo_theme", theme);
}


function initializeTheme() {
  const savedTheme = localStorage.getItem("theo_theme");

  applyTheme(
    savedTheme === "light"
      ? "light"
      : "dark"
  );
}


themeToggle.addEventListener("click", () => {
  const isLight =
    document.body.classList.contains("light-theme");

  applyTheme(
    isLight
      ? "dark"
      : "light"
  );
});


/* =========================================================
   HISTORY SIDEBAR
========================================================= */

function openHistory() {
  historySidebar.classList.add("open");
  historyOverlay.classList.add("open");

  document.body.classList.add("history-open");

  loadConversations();
}


function closeHistory() {
  historySidebar.classList.remove("open");
  historyOverlay.classList.remove("open");

  document.body.classList.remove("history-open");
}


openHistoryButton.addEventListener(
  "click",
  openHistory
);


closeHistoryButton.addEventListener(
  "click",
  closeHistory
);


historyOverlay.addEventListener(
  "click",
  closeHistory
);


/* =========================================================
   CREATE CONVERSATION
========================================================= */

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

  conversationId = data.conversationId;

  localStorage.setItem(
    "theo_conversation_id",
    conversationId
  );

  conversationHistory = [];

  return conversationId;
}


/* =========================================================
   LOAD CURRENT CONVERSATION
========================================================= */

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
      data.error ||
      "Could not load conversation"
    );
  }

  conversationHistory = data.messages
    .filter(
      message =>
        message.role === "user" ||
        message.role === "assistant"
    )
    .map(
      message => ({
        role: message.role,
        content: message.content
      })
    )
    .slice(-20);

  chat.innerHTML = "";

  if (conversationHistory.length === 0) {
    showWelcome();
    return;
  }

  conversationHistory.forEach(message => {
    addMessage(
      message.content,
      message.role
    );
  });
}


/* =========================================================
   LOAD CONVERSATIONS
========================================================= */

async function loadConversations() {
  if (!userId) {
    return;
  }

  conversationList.innerHTML = `
    <div class="history-empty">
      Loading chats...
    </div>
  `;

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

    conversations =
      data.conversations || [];

    renderConversations(
      conversationSearch.value
    );

  } catch (error) {
    console.error(
      "Conversation history error:",
      error
    );

    conversationList.innerHTML = `
      <div class="history-empty">
        Could not load your chats.
      </div>
    `;
  }
}


/* =========================================================
   RENDER CONVERSATIONS
========================================================= */

function renderConversations(searchTerm = "") {
  const term =
    searchTerm
      .trim()
      .toLowerCase();

  const filtered =
    conversations.filter(
      conversation => {
        const title =
          String(
            conversation.title ||
            ""
          ).toLowerCase();

        return title.includes(term);
      }
    );

  if (filtered.length === 0) {
    conversationList.innerHTML = `
      <div class="history-empty">
        ${
          term
            ? "No conversations found."
            : "No conversations yet."
        }
      </div>
    `;

    return;
  }

  conversationList.innerHTML = "";

  filtered.forEach(conversation => {
    const id = conversation.id;

    const title =
      conversation.title ||
      "New conversation";

    const date =
      conversation.updated_at ||
      conversation.created_at;

    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      "conversation-item";

    if (
      String(id) ===
      String(conversationId)
    ) {
      button.classList.add("active");
    }

    button.innerHTML = `
      <span class="conversation-name">
        ${escapeHtml(
          makeConversationTitle(title)
        )}
      </span>

      <span class="conversation-date">
        ${formatDate(date)}
      </span>
    `;

    button.addEventListener(
      "click",
      () => selectConversation(id)
    );

    conversationList.appendChild(
      button
    );
  });
}


/* =========================================================
   SEARCH
========================================================= */

conversationSearch.addEventListener(
  "input",
  () => {
    renderConversations(
      conversationSearch.value
    );
  }
);


/* =========================================================
   SELECT CONVERSATION
========================================================= */

async function selectConversation(id) {
  conversationId = id;

  localStorage.setItem(
    "theo_conversation_id",
    conversationId
  );

  try {
    await loadConversationHistory();

    closeHistory();

    input.focus();

  } catch (error) {
    console.error(
      "Conversation loading error:",
      error
    );

    alert(
      "Could not open this conversation."
    );
  }
}


/* =========================================================
   NEW CHAT
========================================================= */

async function startNewChat() {
  try {
    await createConversation();

    conversationHistory = [];
    chat.innerHTML = "";

    showWelcome();

    conversationSearch.value = "";
    input.value = "";

    await loadConversations();

    closeHistory();

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


historyNewChatButton.addEventListener(
  "click",
  startNewChat
);


/* =========================================================
   SEND MESSAGE
========================================================= */

form.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const message =
      input.value.trim();

    if (!message) {
      return;
    }

    lastUserMessage = message;

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


/* =========================================================
   ADD MESSAGE
========================================================= */

function addMessage(
  text,
  sender
) {
  const message =
    document.createElement("div");

  message.className =
    `message ${sender}`;

  const content =
    document.createElement("div");

  content.className =
    "message-content";

  const bubble =
    document.createElement("div");

  bubble.className =
    "bubble";

  bubble.textContent =
    text;

  content.appendChild(
    bubble
  );

  if (sender === "assistant") {
    content.appendChild(
      createMessageActions(
        text
      )
    );
  }

  message.appendChild(
    content
  );

  chat.appendChild(
    message
  );

  chat.scrollTop =
    chat.scrollHeight;

  return message;
}


/* =========================================================
   MESSAGE ACTIONS
========================================================= */

function createMessageActions(text) {
  const actions =
    document.createElement("div");

  actions.className =
    "message-actions";


  /* COPY */

  const copyButton =
    createActionButton(
      "⧉",
      "Copy"
    );

  copyButton.addEventListener(
    "click",
    async () => {
      try {
        await navigator.clipboard.writeText(
          text
        );

        copyButton.textContent =
          "✓";

        setTimeout(
          () => {
            copyButton.textContent =
              "⧉";
          },
          1200
        );

      } catch (error) {
        console.error(
          "Copy error:",
          error
        );
      }
    }
  );


  /* LIKE */

  const likeButton =
    createActionButton(
      "👍",
      "Good response"
    );

  likeButton.addEventListener(
    "click",
    () => {
      likeButton.textContent =
        "👍✓";
    }
  );


  /* DISLIKE */

  const dislikeButton =
    createActionButton(
      "👎",
      "Bad response"
    );

  dislikeButton.addEventListener(
    "click",
    () => {
      dislikeButton.textContent =
        "👎✓";
    }
  );


  /* TEXT TO SPEECH */

  const voiceButton =
    createActionButton(
      "🔊",
      "Read aloud"
    );

  voiceButton.addEventListener(
    "click",
    () => {
      if (
        !("speechSynthesis" in window)
      ) {
        alert(
          "Text-to-speech is not supported on this device."
        );

        return;
      }

      window.speechSynthesis.cancel();

      const speech =
        new SpeechSynthesisUtterance(
          text
        );

      speech.lang =
        "en-US";

      window.speechSynthesis.speak(
        speech
      );
    }
  );


  /* SHARE */

  const shareButton =
    createActionButton(
      "↗",
      "Share"
    );

  shareButton.addEventListener(
    "click",
    async () => {
      try {
        if (
          navigator.share
        ) {
          await navigator.share({
            title: "Theo AI",
            text
          });

        } else {
          await navigator.clipboard.writeText(
            text
          );

          alert(
            "Message copied. You can now share it."
          );
        }

      } catch (error) {
        if (
          error.name !==
          "AbortError"
        ) {
          console.error(
            "Share error:",
            error
          );
        }
      }
    }
  );


  /* MORE MENU */

  const menuWrapper =
    document.createElement(
      "div"
    );

  menuWrapper.className =
    "message-menu";

  const menuButton =
    createActionButton(
      "⋮",
      "More options"
    );

  const popup =
    document.createElement(
      "div"
    );

  popup.className =
    "message-menu-popup";


  /* DATE AND TIME */

  const timeItem =
    document.createElement(
      "button"
    );

  timeItem.type =
    "button";

  timeItem.className =
    "message-menu-item";

  timeItem.textContent =
    "🕒 " +
    formatFullDate(
      new Date()
    );


  /* BRANCH */

  const branchItem =
    document.createElement(
      "button"
    );

  branchItem.type =
    "button";

  branchItem.className =
    "message-menu-item";

  branchItem.textContent =
    "🌿 Branch in new chat";

  branchItem.addEventListener(
    "click",
    async () => {
      await branchConversation();

      popup.classList.remove(
        "open"
      );
    }
  );


  /* RETRY */

  const retryItem =
    document.createElement(
      "button"
    );

  retryItem.type =
    "button";

  retryItem.className =
    "message-menu-item";

  retryItem.textContent =
    "↻ Retry";

  retryItem.addEventListener(
    "click",
    async () => {
      popup.classList.remove(
        "open"
      );

      await retryLastMessage();
    }
  );


  popup.appendChild(
    timeItem
  );

  popup.appendChild(
    branchItem
  );

  popup.appendChild(
    retryItem
  );

  menuWrapper.appendChild(
    menuButton
  );

  menuWrapper.appendChild(
    popup
  );


  menuButton.addEventListener(
    "click",
    event => {
      event.stopPropagation();

      closeAllMenus(
        popup
      );

      popup.classList.toggle(
        "open"
      );
    }
  );


  actions.appendChild(
    copyButton
  );

  actions.appendChild(
    likeButton
  );

  actions.appendChild(
    dislikeButton
  );

  actions.appendChild(
    voiceButton
  );

  actions.appendChild(
    shareButton
  );

  actions.appendChild(
    menuWrapper
  );

  return actions;
}


function createActionButton(
  icon,
  label
) {
  const button =
    document.createElement(
      "button"
    );

  button.type =
    "button";

  button.className =
    "message-action";

  button.textContent =
    icon;

  button.title =
    label;

  button.setAttribute(
    "aria-label",
    label
  );

  return button;
}


/* =========================================================
   BRANCH IN NEW CHAT
========================================================= */

async function branchConversation() {
  try {
    const branchHistory =
      [...conversationHistory];

    await createConversation();

    conversationHistory =
      branchHistory;

    chat.innerHTML = "";

    conversationHistory.forEach(
      message => {
        addMessage(
          message.content,
          message.role
        );
      }
    );

    await loadConversations();

    input.focus();

  } catch (error) {
    console.error(
      "Branch error:",
      error
    );

    alert(
      "Could not create a branch."
    );
  }
}


/* =========================================================
   RETRY
========================================================= */

async function retryLastMessage() {
  if (
    !lastUserMessage
  ) {
    for (
      let i =
        conversationHistory.length - 1;
      i >= 0;
      i--
    ) {
      if (
        conversationHistory[i].role ===
        "user"
      ) {
        lastUserMessage =
          conversationHistory[i].content;

        break;
      }
    }
  }

  if (
    !lastUserMessage
  ) {
    return;
  }

  const messageToRetry =
    lastUserMessage;

  let lastUserIndex = -1;

  for (
    let i =
      conversationHistory.length - 1;
    i >= 0;
    i--
  ) {
    if (
      conversationHistory[i].role ===
      "user"
    ) {
      lastUserIndex = i;
      break;
    }
  }

  if (
    lastUserIndex !== -1
  ) {
    conversationHistory =
      conversationHistory.slice(
        0,
        lastUserIndex
      );
  }

  chat.innerHTML = "";

  conversationHistory.forEach(
    message => {
      addMessage(
        message.content,
        message.role
      );
    }
  );

  input.value =
    messageToRetry;

  form.requestSubmit();
}


/* =========================================================
   WELCOME SCREEN
========================================================= */

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

      <div class="message-content">

        <div class="bubble">
          What would you like to talk about?
        </div>

        <div class="message-actions">

          <button
            class="message-action"
            type="button"
            title="Copy"
            aria-label="Copy"
            onclick="copyText('What would you like to talk about?')"
          >
            ⧉
          </button>

        </div>

      </div>

    </div>
  `;
}


/* =========================================================
   COPY HELPER
========================================================= */

window.copyText =
  async function(text) {
    try {
      await navigator.clipboard.writeText(
        text
      );
    } catch (error) {
      console.error(
        "Copy failed:",
        error
      );
    }
  };


/* =========================================================
   TYPING INDICATOR
========================================================= */

function addTypingIndicator() {
  const message =
    document.createElement(
      "div"
    );

  message.className =
    "message assistant typing";

  const bubble =
    document.createElement(
      "div"
    );

  bubble.className =
    "bubble";

  for (
    let i = 0;
    i < 3;
    i++
  ) {
    const dot =
      document.createElement(
        "span"
      );

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


/* ==============
   MESSAGE ACTIONS
========================================================= */

/* =========================================================
   BRANCH IN NEW CHAT
========================================================= */

async function branchConversation() {
  try {
    const branchHistory =
      [...conversationHistory];

    await createConversation();

    conversationHistory =
      branchHistory;

    chat.innerHTML = "";

    conversationHistory.forEach(
      message => {
        addMessage(
          message.content,
          message.role
        );
      }
    );

    await loadConversations();

    input.focus();

  } catch (error) {
    console.error(
      "Branch error:",
      error
    );

    alert(
      "Could not create a branch."
    );
  }
}


/* =========================================================
   RETRY
========================================================= */

async function retryLastMessage() {
  if (
    !lastUserMessage
  ) {
    for (
      let i =
        conversationHistory.length - 1;
      i >= 0;
      i--
    ) {
      if (
        conversationHistory[i].role ===
        "user"
      ) {
        lastUserMessage =
          conversationHistory[i].content;

        break;
      }
    }
  }

  if (
    !lastUserMessage
  ) {
    return;
  }

  const messageToRetry =
    lastUserMessage;

  let lastUserIndex = -1;

  for (
    let i =
      conversationHistory.length - 1;
    i >= 0;
    i--
  ) {
    if (
      conversationHistory[i].role ===
      "user"
    ) {
      lastUserIndex = i;
      break;
    }
  }

  if (
    lastUserIndex !== -1
  ) {
    conversationHistory =
      conversationHistory.slice(
        0,
        lastUserIndex
      );
  }

  chat.innerHTML = "";

  conversationHistory.forEach(
    message => {
      addMessage(
        message.content,
        message.role
      );
    }
  );

  input.value =
    messageToRetry;

  form.requestSubmit();
}


/* =========================================================
   WELCOME SCREEN
========================================================= */

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

      <div class="message-content">

        <div class="bubble">
          What would you like to talk about?
        </div>

        <div class="message-actions">

          <button
            class="message-action"
            type="button"
            title="Copy"
            aria-label="Copy"
            onclick="copyText('What would you like to talk about?')"
          >
            ⧉
          </button>

        </div>

      </div>

    </div>
  `;
}


/* =========================================================
   COPY HELPER
========================================================= */

window.copyText =
  async function(text) {
    try {
      await navigator.clipboard.writeText(
        text
      );
    } catch (error) {
      console.error(
        "Copy failed:",
        error
      );
    }
  };


/* =========================================================
   TYPING INDICATOR
========================================================= */

function addTypingIndicator() {
  const message =
    document.createElement(
      "div"
    );

  message.className =
    "message assistant typing";

  const bubble =
    document.createElement(
      "div"
    );

  bubble.className =
    "bubble";

  for (
    let i = 0;
    i < 3;
    i++
  ) {
    const dot =
      document.createElement(
        "span"
      );

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


/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(value) {
  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


function makeConversationTitle(title) {
  const clean =
    String(title || "")
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (!clean) {
    return "New conversation";
  }

  return clean.length > 55
    ? clean.slice(0, 55) + "..."
    : clean;
}


function formatDate(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

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


function formatFullDate(date) {
  return date.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}


function closeAllMenus(
  except = null
) {
  document
    .querySelectorAll(
      ".message-menu-popup.open"
    )
    .forEach(menu => {
      if (menu !== except) {
        menu.classList.remove(
          "open"
        );
      }
    });
}


/* =========================================================
   CLOSE MENUS WHEN CLICKING ELSEWHERE
========================================================= */

document.addEventListener(
  "click",
  event => {
    if (
      !event.target.closest(
        ".message-menu"
      )
    ) {
      closeAllMenus();
    }
  }
);


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeUser() {
  initializeTheme();

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


initializeUser().catch(
  error => {
    console.error(
      "Initialization error:",
      error
    );
  }
);
