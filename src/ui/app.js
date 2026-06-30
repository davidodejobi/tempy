let selectedInboxId = null;
let selectedMsgId = null;

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  return res.json();
}

async function loadInboxes() {
  const inboxes = await api("GET", "/api/inboxes");
  const list = document.getElementById("inbox-list");
  list.innerHTML = "";
  if (!inboxes.length) {
    list.innerHTML = '<div class="empty">No inboxes yet.<br>Click + New Inbox.</div>';
    return;
  }
  inboxes.forEach((inbox) => {
    const el = document.createElement("div");
    el.className = "inbox-item" + (inbox.id === selectedInboxId ? " active" : "");
    el.innerHTML = `<span>${inbox.address}</span><span class="count">${inbox.messageCount}</span>`;
    el.onclick = () => selectInbox(inbox.id);
    list.appendChild(el);
  });
}

async function selectInbox(id) {
  selectedInboxId = id;
  selectedMsgId = null;
  document.getElementById("message-body").innerHTML = "";
  await loadInboxes();
  await loadMessages(id);
}

async function loadMessages(inboxId) {
  const messages = await api("GET", `/api/inboxes/${inboxId}/messages`);
  const list = document.getElementById("message-list");
  list.innerHTML = "";
  if (!messages.length) {
    list.innerHTML = '<li class="empty">No messages yet.</li>';
    return;
  }
  messages.forEach((msg) => {
    const li = document.createElement("li");
    li.className = "msg-item" + (msg.id === selectedMsgId ? " active" : "");
    li.innerHTML = `<div class="subject">${msg.subject || "(no subject)"}</div><div class="from">${msg.from}</div>`;
    li.onclick = () => loadMessageBody(inboxId, msg.id);
    list.appendChild(li);
  });
}

async function loadMessageBody(inboxId, msgId) {
  selectedMsgId = msgId;
  const detail = await api("GET", `/api/inboxes/${inboxId}/messages/${msgId}`);
  document.getElementById("message-body").innerHTML = `
    <h2>${detail.subject || "(no subject)"}</h2>
    <div class="meta">From: ${detail.from}</div>
    <pre>${detail.text || "(no plain text body)"}</pre>
  `;
}

document.getElementById("btn-new").onclick = async () => {
  await api("POST", "/api/inboxes");
  await loadInboxes();
};

loadInboxes();
setInterval(() => {
  loadInboxes();
  if (selectedInboxId) loadMessages(selectedInboxId);
}, 3000);
