import { randomBytes } from "node:crypto";

const BASE_URL = "https://api.mail.tm";

export interface MailTmInbox {
  id: string;
  address: string;
  token: string;
  password: string;
}

export interface MailTmMessage {
  id: string;
  subject: string;
  from: { address: string; name: string };
  intro: string;
  createdAt: string;
  seen: boolean;
}

export interface MailTmMessageDetail extends MailTmMessage {
  text: string;
  html: string[];
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"; // 36 chars, email-local-part safe

// CSPRNG-backed random string. Uses rejection sampling to avoid modulo bias.
function randomString(length: number): string {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length; // 252
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length - out.length)) {
      if (byte < limit) out += ALPHABET[byte % ALPHABET.length];
    }
  }
  return out;
}

function authError(status: number, fallback: string): Error {
  return new Error(status === 401 ? "401 Unauthorized" : fallback);
}

export async function createMailTmInbox(): Promise<MailTmInbox> {
  const domainsRes = await fetch(`${BASE_URL}/domains?page=1`);
  if (!domainsRes.ok) throw new Error("Failed to fetch domains");
  const domainsData = await domainsRes.json() as { "hydra:member": { domain: string }[] };
  const domain = domainsData["hydra:member"][0].domain;

  const address = `${randomString(10)}@${domain}`;
  const password = randomString(16);

  const createRes = await fetch(`${BASE_URL}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  if (!createRes.ok) throw new Error("Failed to create account");
  const account = await createRes.json() as { id: string };

  const tokenRes = await fetch(`${BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  if (!tokenRes.ok) throw new Error("Failed to get token");
  const tokenData = await tokenRes.json() as { token: string };

  return { id: account.id, address, token: tokenData.token, password };
}

export async function fetchMessages(token: string): Promise<MailTmMessage[]> {
  const res = await fetch(`${BASE_URL}/messages?page=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw authError(res.status, "Failed to fetch messages");
  const data = await res.json() as { "hydra:member": MailTmMessage[] };
  return data["hydra:member"];
}

export async function fetchMessage(token: string, messageId: string): Promise<MailTmMessageDetail> {
  const res = await fetch(`${BASE_URL}/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw authError(res.status, `Failed to fetch message ${messageId}`);
  return res.json() as Promise<MailTmMessageDetail>;
}

export async function loginMailTm(address: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  if (!res.ok) throw authError(res.status, "Failed to log in");
  const data = await res.json() as { token: string };
  return data.token;
}

export async function fetchAccount(token: string): Promise<{ used: number; quota: number }> {
  const res = await fetch(`${BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw authError(res.status, "Failed to fetch account");
  const data = await res.json() as { used: number; quota: number };
  return { used: data.used, quota: data.quota };
}

export async function markSeen(token: string, messageId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/messages/${messageId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/merge-patch+json" },
    body: JSON.stringify({ seen: true }),
  });
  if (!res.ok) throw authError(res.status, "Failed to mark message seen");
}

export async function deleteMailTmAccount(token: string, accountId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/accounts/${accountId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) throw new Error("Failed to delete account");
}
