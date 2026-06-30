import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import {
  createInbox, listInboxSummaries, getMessages, getMessageDetail,
  deleteInbox, deleteMessage, getQuota, getCredentials,
} from "./inbox-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Maps a thrown error to an HTTP response: not-found → 404, else 500.
function fail(res: express.Response, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/ not found$/.test(msg)) res.status(404).json({ error: msg });
  else res.status(500).json({ error: msg });
}

export function createHttpServer() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "ui")));

  app.get("/api/inboxes", (_req, res) => {
    res.json(listInboxSummaries());
  });

  app.post("/api/inboxes", async (_req, res) => {
    try { res.status(201).json(await createInbox()); }
    catch (e) { fail(res, e); }
  });

  app.get("/api/inboxes/:id/messages", async (req, res) => {
    try { res.json(await getMessages(req.params.id)); }
    catch (e) { fail(res, e); }
  });

  app.get("/api/inboxes/:id/messages/:msgId", async (req, res) => {
    try { res.json(await getMessageDetail(req.params.id, req.params.msgId)); }
    catch (e) { fail(res, e); }
  });

  app.get("/api/inboxes/:id/quota", async (req, res) => {
    try { res.json(await getQuota(req.params.id)); }
    catch (e) { fail(res, e); }
  });

  app.get("/api/inboxes/:id/credentials", (req, res) => {
    try { res.json(getCredentials(req.params.id)); }
    catch (e) { fail(res, e); }
  });

  app.delete("/api/inboxes/:id/messages/:msgId", async (req, res) => {
    try { await deleteMessage(req.params.id, req.params.msgId); res.status(204).send(); }
    catch (e) { fail(res, e); }
  });

  app.delete("/api/inboxes/:id", async (req, res) => {
    try { await deleteInbox(req.params.id); res.status(204).send(); }
    catch (e) { fail(res, e); }
  });

  return app;
}
