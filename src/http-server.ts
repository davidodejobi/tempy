import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createMailTmInbox, fetchMessages, fetchMessage, deleteMailTmAccount } from "./mailtm.js";
import { addInbox, getInbox, listInboxes, updateMessages, removeInbox } from "./inbox-store.js";
import type { StoredMessage } from "./inbox-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createHttpServer() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "ui")));

  app.get("/api/inboxes", (_req, res) => {
    res.json(
      listInboxes().map(({ id, address, messages }) => ({ id, address, messageCount: messages.length }))
    );
  });

  app.post("/api/inboxes", async (_req, res) => {
    try {
      const mailtm = await createMailTmInbox();
      addInbox({ ...mailtm, messages: [] });
      res.status(201).json(getInbox(mailtm.id));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/inboxes/:id/messages", async (req, res) => {
    const inbox = getInbox(req.params.id);
    if (!inbox) { res.status(404).json({ error: "Inbox not found" }); return; }
    try {
      const raw = await fetchMessages(inbox.token);
      const messages: StoredMessage[] = raw.map((m) => ({
        id: m.id, subject: m.subject, from: m.from.address, intro: m.intro, createdAt: m.createdAt,
      }));
      updateMessages(inbox.id, messages);
      res.json(messages);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/inboxes/:id/messages/:msgId", async (req, res) => {
    const inbox = getInbox(req.params.id);
    if (!inbox) { res.status(404).json({ error: "Inbox not found" }); return; }
    try {
      const detail = await fetchMessage(inbox.token, req.params.msgId);
      res.json({ subject: detail.subject, from: detail.from.address, text: detail.text, html: detail.html });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/inboxes/:id", async (req, res) => {
    const inbox = getInbox(req.params.id);
    if (!inbox) { res.status(404).json({ error: "Inbox not found" }); return; }
    try {
      await deleteMailTmAccount(inbox.token, inbox.id);
      removeInbox(inbox.id);
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return app;
}
