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
    // Start a clean local chat without creating an empty database conversation
    conversationId = null;
    localStorage.removeItem("theo_conversation_id");

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
      // Create the database conversation only when the user sends the first message
      if (!conversationId) {
        await createConversation();
      }

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

  // Always start on the main Theo screen after a refresh.
  // Previous conversations remain available in History.
  conversationId = null;
  localStorage.removeItem("theo_conversation_id");

  conversationHistory = [];
  showWelcome();

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


/* THEO_LIVE_VOICE_V1 */

(() => {
  const startButton =
    document.getElementById("voice-start-button");

  const stopButton =
    document.getElementById("voice-stop-button");

  const status =
    document.getElementById("voice-status");

  if (!startButton || !stopButton || !status) {
    console.warn(
      "Theo Live voice UI not found."
    );
    return;
  }

  let socket = null;
  let microphoneStream = null;
  let audioContext = null;
  let processor = null;
  let source = null;

  let playbackContext = null;
  let nextPlaybackTime = 0;

  const setStatus = (message) => {
    status.textContent = message;
  };

  const floatTo16BitPCM = (float32) => {
    const buffer =
      new ArrayBuffer(float32.length * 2);

    const view =
      new DataView(buffer);

    for (let i = 0; i < float32.length; i++) {
      const sample =
        Math.max(-1, Math.min(1, float32[i]));

      view.setInt16(
        i * 2,
        sample < 0
          ? sample * 0x8000
          : sample * 0x7fff,
        true
      );
    }

    return new Uint8Array(buffer);
  };

  const arrayBufferToBase64 = (buffer) => {
    let binary = "";

    const bytes =
      new Uint8Array(buffer);

    const chunkSize = 0x8000;

    for (
      let i = 0;
      i < bytes.length;
      i += chunkSize
    ) {
      binary += String.fromCharCode(
        ...bytes.subarray(
          i,
          Math.min(
            i + chunkSize,
            bytes.length
          )
        )
      );
    }

    return btoa(binary);
  };

  const base64ToArrayBuffer = (base64) => {
    const binary =
      atob(base64);

    const buffer =
      new ArrayBuffer(binary.length);

    const bytes =
      new Uint8Array(buffer);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] =
        binary.charCodeAt(i);
    }

    return buffer;
  };

  const playPCM24k = (base64) => {
    try {
      if (!playbackContext) {
        playbackContext =
          new AudioContext({
            sampleRate: 24000
          });
      }

      const bytes =
        new Int16Array(
          base64ToArrayBuffer(base64)
        );

      const audioBuffer =
        playbackContext.createBuffer(
          1,
          bytes.length,
          24000
        );

      const channel =
        audioBuffer.getChannelData(0);

      for (let i = 0; i < bytes.length; i++) {
        channel[i] =
          bytes[i] / 32768;
      }

      const node =
        playbackContext.createBufferSource();

      node.buffer = audioBuffer;
      node.connect(
        playbackContext.destination
      );

      const startTime =
        Math.max(
          playbackContext.currentTime,
          nextPlaybackTime
        );

      node.start(startTime);

      nextPlaybackTime =
        startTime +
        audioBuffer.duration;

    } catch (error) {
      console.error(
        "Theo Live playback error:",
        error
      );
    }
  };

  const handleLiveMessage = (payload) => {
    const message =
      payload?.data || payload;

    const serverContent =
      message?.serverContent;

    if (!serverContent) {
      return;
    }

    const parts =
      serverContent.modelTurn?.parts || [];

    for (const part of parts) {
      const inlineData =
        part?.inlineData;

      if (
        inlineData?.mimeType?.startsWith(
          "audio/"
        ) &&
        inlineData?.data
      ) {
        playPCM24k(
          inlineData.data
        );
      }
    }

    if (
      serverContent.turnComplete
    ) {
      setStatus(
        "🟢 Theo is listening..."
      );
    }
  };

  const stopMicrophone = () => {
    if (processor) {
      processor.disconnect();
      processor.onaudioprocess = null;
      processor = null;
    }

    if (source) {
      source.disconnect();
      source = null;
    }

    if (microphoneStream) {
      microphoneStream
        .getTracks()
        .forEach(track => track.stop());

      microphoneStream = null;
    }

    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
  };

  const stopLive = () => {
    stopMicrophone();

    if (socket) {
      try {
        socket.close();
      } catch (_) {}

      socket = null;
    }

    startButton.hidden = false;
    stopButton.hidden = true;

    setStatus(
      "🔴 Voice chat is off"
    );
  };

  startButton.addEventListener(
    "click",
    async () => {
      try {
        if (socket) {
          return;
        }

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error(
            "Microphone access is not supported by this browser."
          );
        }

        setStatus(
          "🟡 Connecting to Theo..."
        );

        const protocol =
          location.protocol === "https:"
            ? "wss:"
            : "ws:";

        socket =
          new WebSocket(
            `${protocol}//${location.host}/api/live`
          );

        socket.onopen = async () => {
          setStatus(
            "🟡 Starting microphone..."
          );

          microphoneStream =
            await navigator.mediaDevices
              .getUserMedia({
                audio: {
                  channelCount: 1,
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true
                }
              });

          audioContext =
            new AudioContext();

          await audioContext.resume();

          source =
            audioContext.createMediaStreamSource(
              microphoneStream
            );

          processor =
            audioContext.createScriptProcessor(
              4096,
              1,
              1
            );

          processor.onaudioprocess =
            (event) => {
              if (
                !socket ||
                socket.readyState !==
                  WebSocket.OPEN
              ) {
                return;
              }

              const inputData =
                event.inputBuffer
                  .getChannelData(0);

              const pcm =
                floatTo16BitPCM(
                  inputData
                );

              socket.send(
                JSON.stringify({
                  type:
                    "realtime_input",
                  data: {
                    audio: {
                      data:
                        arrayBufferToBase64(
                          pcm
                        ),
                      mimeType:
                        "audio/pcm;rate=16000"
                    }
                  }
                })
              );
            };

          source.connect(processor);

          processor.connect(
            audioContext.destination
          );

          startButton.hidden = true;
          stopButton.hidden = false;

          setStatus(
            "🟢 Talk to Theo..."
          );
        };

        socket.onmessage = (event) => {
          try {
            const payload =
              JSON.parse(event.data);

            if (
              payload.type ===
              "live_connected"
            ) {
              setStatus(
                "🟢 Theo is listening..."
              );
              return;
            }

            if (
              payload.type ===
              "live_message"
            ) {
              handleLiveMessage(
                payload
              );
              return;
            }

            if (
              payload.type ===
              "live_error"
            ) {
              console.error(
                "Theo Live:",
                payload.error
              );

              setStatus(
                "🔴 Live voice error"
              );

              stopLive();
              return;
            }

            if (
              payload.type ===
              "live_closed"
            ) {
              stopLive();
            }

          } catch (error) {
            console.error(
              "Theo Live message parsing error:",
              error
            );
          }
        };

        socket.onerror = (error) => {
          console.error(
            "Theo Live WebSocket error:",
            error
          );

          setStatus(
            "🔴 Voice connection error"
          );
        };

        socket.onclose = () => {
          stopMicrophone();

          socket = null;

          startButton.hidden = false;
          stopButton.hidden = true;

          if (
            status.textContent.includes(
              "🟢"
            )
          ) {
            setStatus(
              "🔴 Voice chat is off"
            );
          }
        };

      } catch (error) {
        console.error(
          "Theo Live start error:",
          error
        );

        stopLive();

        setStatus(
          `🔴 ${error.message}`
        );
      }
    }
  );

  stopButton.addEventListener(
    "click",
    stopLive
  );
})();

