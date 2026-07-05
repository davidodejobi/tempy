let selectedInboxId = null;
let selectedMsgId = null;
let selectedAddress = null;
let viewMode = "html"; // "html" | "text"
let lastDetail = null;

async function api(method, path) {
  const res = await fetch(path, { method });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function initials(value) {
  const s = (value || "?").trim();
  return s.charAt(0).toUpperCase();
}

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function copy(value) {
  try { await navigator.clipboard.writeText(value); } catch { /* clipboard blocked */ }
}

async function deleteSelectedInbox() {
  if (!selectedInboxId) return;
  await api("DELETE", `/api/inboxes/${selectedInboxId}`);
  selectedInboxId = null; selectedMsgId = null; selectedAddress = null; lastDetail = null;
  document.getElementById("message-list").innerHTML = "";
  document.getElementById("messages-summary").textContent = "";
  document.getElementById("reader-toolbar").innerHTML = "";
  document.getElementById("reader-body").innerHTML = "";
  await loadInboxes();
}

async function loadInboxes() {
  const inboxes = await api("GET", "/api/inboxes");
  const list = document.getElementById("inbox-list");
  list.innerHTML = "";
  if (!inboxes.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No inboxes yet.";
    list.appendChild(empty);
  } else {
    inboxes.forEach((inbox) => {
      const el = document.createElement("div");
      el.className = "inbox-item" + (inbox.id === selectedInboxId ? " active" : "");
      const addr = document.createElement("span"); addr.className = "addr"; addr.textContent = inbox.address;
      el.append(addr);
      if (inbox.unreadCount > 0) {
        const badge = document.createElement("span"); badge.className = "badge"; badge.textContent = inbox.unreadCount;
        el.appendChild(badge);
      }
      el.onclick = () => selectInbox(inbox.id, inbox.address);
      list.appendChild(el);
    });
  }
  renderStatus();
}

function renderStatus() {
  const panel = document.getElementById("status-panel");
  const quota = document.getElementById("quota-panel");
  panel.innerHTML = "";
  if (!selectedInboxId) { quota.innerHTML = ""; return; }

  const statusRow = document.createElement("div"); statusRow.className = "row";
  const dot = document.createElement("span"); dot.className = "dot";
  const sk = document.createElement("span"); sk.className = "k"; sk.textContent = "Status";
  const sv = document.createElement("span"); sv.className = "v"; sv.textContent = "Active";
  statusRow.append(sk, dot, sv);

  const addrRow = document.createElement("div"); addrRow.className = "row";
  const ak = document.createElement("span"); ak.className = "k"; ak.textContent = "Address";
  const av = document.createElement("span"); av.className = "v"; av.textContent = selectedAddress || "";
  const aBtn = document.createElement("button"); aBtn.className = "copy-btn"; aBtn.textContent = "Copy";
  aBtn.onclick = () => copy(selectedAddress || "");
  addrRow.append(ak, av, aBtn);

  const pwRow = document.createElement("div"); pwRow.className = "row";
  const pk = document.createElement("span"); pk.className = "k"; pk.textContent = "Password";
  const pv = document.createElement("span"); pv.className = "v"; pv.textContent = "••••••••";
  const pBtn = document.createElement("button"); pBtn.className = "copy-btn"; pBtn.textContent = "Copy";
  pBtn.onclick = async () => {
    const creds = await api("GET", `/api/inboxes/${selectedInboxId}/credentials`);
    copy(creds.password);
  };
  pwRow.append(pk, pv, pBtn);

  const delRow = document.createElement("div"); delRow.className = "row";
  const delBtn = document.createElement("button"); delBtn.className = "delete-address"; delBtn.textContent = "🗑 Delete address";
  delBtn.onclick = deleteSelectedInbox;
  delRow.append(delBtn);

  panel.append(statusRow, addrRow, pwRow, delRow);
  loadQuota();
}

async function loadQuota() {
  if (!selectedInboxId) return;
  const quota = document.getElementById("quota-panel");
  try {
    const q = await api("GET", `/api/inboxes/${selectedInboxId}/quota`);
    const label = document.createElement("div");
    label.textContent = `Quota: ${Math.round(q.used / 1024)} KB / ${Math.round(q.quota / 1024 / 1024)} MB`;
    const bar = document.createElement("div"); bar.className = "quota-bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.min(100, (q.used / q.quota) * 100)}%`;
    bar.appendChild(fill);
    quota.replaceChildren(label, bar);
  } catch { /* quota unavailable */ }
}

async function selectInbox(id, address) {
  selectedInboxId = id;
  selectedAddress = address;
  selectedMsgId = null;
  document.getElementById("reader-toolbar").innerHTML = "";
  document.getElementById("reader-body").innerHTML = "";
  await loadInboxes();
  await loadMessages(id);
}

async function loadMessages(inboxId) {
  const summary = document.getElementById("messages-summary");
  const list = document.getElementById("message-list");
  let messages;
  try { messages = await api("GET", `/api/inboxes/${inboxId}/messages`); }
  catch { return; }
  const unread = messages.filter((m) => !m.seen).length;
  summary.textContent = `${messages.length} message${messages.length === 1 ? "" : "s"}, ${unread} unread`;
  list.innerHTML = "";
  if (!messages.length) {
    const empty = document.createElement("li"); empty.className = "empty"; empty.textContent = "No messages yet.";
    list.appendChild(empty);
    return;
  }
  messages.forEach((msg) => {
    const li = document.createElement("li");
    li.className = "msg-item" + (msg.id === selectedMsgId ? " active" : "");
    const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = initials(msg.from);
    const main = document.createElement("div"); main.className = "msg-main";
    const top = document.createElement("div"); top.className = "msg-top";
    const from = document.createElement("div"); from.className = "msg-from"; from.textContent = msg.from;
    const time = document.createElement("div"); time.className = "msg-time"; time.textContent = timeAgo(msg.createdAt);
    top.append(from, time);
    const subject = document.createElement("div"); subject.className = "msg-subject"; subject.textContent = msg.subject || "(no subject)";
    const intro = document.createElement("div"); intro.className = "msg-intro"; intro.textContent = msg.intro || "";
    main.append(top, subject, intro);
    li.append(avatar, main);
    if (!msg.seen) { const dot = document.createElement("div"); dot.className = "unread"; li.appendChild(dot); }
    li.onclick = () => loadMessageBody(inboxId, msg.id);
    list.appendChild(li);
  });
}

async function loadMessageBody(inboxId, msgId) {
  selectedMsgId = msgId;
  lastDetail = await api("GET", `/api/inboxes/${inboxId}/messages/${msgId}`);
  renderReader();
  loadMessages(inboxId); // refresh seen state
}

function renderReader() {
  const detail = lastDetail;
  const toolbar = document.getElementById("reader-toolbar");
  const body = document.getElementById("reader-body");
  toolbar.innerHTML = "";
  body.innerHTML = "";
  if (!detail) return;

  const delMsg = document.createElement("button"); delMsg.className = "icon-btn"; delMsg.textContent = "🗑 Delete message";
  delMsg.onclick = async () => {
    await api("DELETE", `/api/inboxes/${selectedInboxId}/messages/${selectedMsgId}`);
    selectedMsgId = null; lastDetail = null;
    toolbar.innerHTML = ""; body.innerHTML = "";
    loadMessages(selectedInboxId);
  };
  const del = document.createElement("button"); del.className = "icon-btn"; del.textContent = "🗑 Delete inbox";
  del.onclick = deleteSelectedInbox;
  const copyAddr = document.createElement("button"); copyAddr.className = "icon-btn"; copyAddr.textContent = "Copy address";
  copyAddr.onclick = () => copy(selectedAddress || "");
  const spacer = document.createElement("div"); spacer.className = "spacer";
  const toggle = document.createElement("div"); toggle.className = "toggle";
  const htmlBtn = document.createElement("button"); htmlBtn.textContent = "HTML"; htmlBtn.className = viewMode === "html" ? "active" : "";
  const textBtn = document.createElement("button"); textBtn.textContent = "Text"; textBtn.className = viewMode === "text" ? "active" : "";
  htmlBtn.onclick = () => { viewMode = "html"; renderReader(); };
  textBtn.onclick = () => { viewMode = "text"; renderReader(); };
  toggle.append(htmlBtn, textBtn);
  toolbar.append(delMsg, del, copyAddr, spacer, toggle);

  const meta = document.createElement("div"); meta.className = "reader-meta";
  const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = initials(detail.from);
  const who = document.createElement("div");
  const name = document.createElement("div"); name.className = "name"; name.textContent = detail.from;
  const date = document.createElement("div"); date.className = "date"; date.textContent = new Date(detail.createdAt).toLocaleString();
  who.append(name, date);
  meta.append(avatar, who);
  const subject = document.createElement("div"); subject.className = "reader-subject"; subject.textContent = detail.subject || "(no subject)";
  body.append(meta, subject);

  const htmlParts = Array.isArray(detail.html) ? detail.html.join("") : "";
  if (viewMode === "html" && htmlParts) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "");
    iframe.srcdoc = htmlParts;
    body.appendChild(iframe);
  } else {
    const pre = document.createElement("pre");
    pre.textContent = detail.text || "(no plain text body)";
    body.appendChild(pre);
  }
}

function setupResizableColumns() {
  const root = document.documentElement;
  const MIN_SIDEBAR = 200, MAX_SIDEBAR = 440;
  const MIN_MESSAGES = 220, MAX_MESSAGES = 560;

  const saved = JSON.parse(localStorage.getItem("tempy-column-widths") || "{}");
  if (saved.sidebar) root.style.setProperty("--sidebar-w", `${saved.sidebar}px`);
  if (saved.messages) root.style.setProperty("--messages-w", `${saved.messages}px`);

  function persist() {
    const sidebar = parseInt(getComputedStyle(root).getPropertyValue("--sidebar-w"), 10);
    const messages = parseInt(getComputedStyle(root).getPropertyValue("--messages-w"), 10);
    localStorage.setItem("tempy-column-widths", JSON.stringify({ sidebar, messages }));
  }

  function makeDraggable(divider, varName, min, max, getStartX) {
    divider.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = getStartX();
      divider.classList.add("dragging");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      function onMove(ev) {
        const next = Math.min(max, Math.max(min, startWidth + (ev.clientX - startX)));
        root.style.setProperty(varName, `${next}px`);
      }
      function onUp() {
        divider.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        persist();
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  makeDraggable(
    document.getElementById("divider-1"),
    "--sidebar-w",
    MIN_SIDEBAR,
    MAX_SIDEBAR,
    () => parseInt(getComputedStyle(root).getPropertyValue("--sidebar-w"), 10)
  );
  makeDraggable(
    document.getElementById("divider-2"),
    "--messages-w",
    MIN_MESSAGES,
    MAX_MESSAGES,
    () => parseInt(getComputedStyle(root).getPropertyValue("--messages-w"), 10)
  );
}

setupResizableColumns();

document.getElementById("btn-new").onclick = async () => {
  await api("POST", "/api/inboxes");
  await loadInboxes();
};

// Deep-link support: `?inbox=<id>` (from the open_dashboard tool) opens the
// dashboard focused on that inbox, and `&msg=<id>` opens that message directly.
async function init() {
  await loadInboxes();
  const params = new URLSearchParams(location.search);
  const wantedInbox = params.get("inbox");
  const wantedMsg = params.get("msg");
  if (!wantedInbox) return;
  const inboxes = await api("GET", "/api/inboxes");
  const match = inboxes.find((i) => i.id === wantedInbox);
  if (!match) return;
  await selectInbox(match.id, match.address);
  if (wantedMsg) await loadMessageBody(match.id, wantedMsg);
}

init();
setInterval(() => {
  loadInboxes();
  if (selectedInboxId) loadMessages(selectedInboxId);
}, 3000);
