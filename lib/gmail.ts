import { google } from "googleapis";
import type { Attachment } from "@/types/database";

export function getGmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  body: string;       // plain text (htmlToText eredménye, vagy sima szöveg)
  htmlBody: string;   // eredeti HTML törzs (ha van), egyébként ""
  snippet: string;
  attachments: Attachment[];
}

const LOG = (...args: unknown[]) =>
  console.log("[GMAIL]", new Date().toISOString(), ...args);

export async function fetchOrderEmails(
  accessToken: string,
  query: string,
  maxResults = 50
): Promise<GmailMessage[]> {
  const gmail = getGmailClient(accessToken);

  LOG("messages.list hívás — q:", query, "| maxResults:", maxResults);

  let listRes;
  try {
    listRes = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    });
    LOG("messages.list HTTP státusz:", listRes.status);
    LOG("Talált üzenetek száma:", listRes.data.messages?.length ?? 0, "| resultSizeEstimate:", listRes.data.resultSizeEstimate);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const details = (err as { response?: { data?: unknown } })?.response?.data;
    LOG("HIBA — messages.list sikertelen:", msg);
    LOG("Részletek:", JSON.stringify(details ?? {}));
    throw err;
  }

  const messages = listRes.data.messages ?? [];
  if (messages.length === 0) {
    LOG("A Gmail API üres listát adott vissza — nincs találat ezzel a lekérdezéssel.");
    return [];
  }

  LOG(`${messages.length} levél részletes lekérése...`);
  let detailed;
  try {
    detailed = await Promise.all(
      messages.map((m) =>
        gmail.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "full",
        })
      )
    );
    LOG(`${detailed.length} levél részletei sikeresen letöltve`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    LOG("HIBA — messages.get sikertelen:", msg);
    throw err;
  }

  return detailed.map((res) => {
    const msg = res.data;
    const headers = msg.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name)?.value ?? "";

    const payload = msg.payload as MessagePart | undefined;
    const htmlBody = payload ? extractHtmlBody(payload) : "";
    const plainBody = payload ? extractPlainBody(payload) : "";
    const body = plainBody || (htmlBody ? htmlToText(htmlBody) : "");
    const attachments = payload ? extractAttachments(payload) : [];

    return {
      id: msg.id!,
      threadId: msg.threadId!,
      subject: get("subject"),
      from: get("from"),
      date: get("date"),
      body,
      htmlBody,
      snippet: msg.snippet ?? "",
      attachments,
    };
  });
}

type MessagePart = {
  mimeType?: string | null;
  filename?: string | null;
  body?: { data?: string | null; attachmentId?: string | null; size?: number | null } | null;
  parts?: MessagePart[] | null;
};

/** Plain text törzs kinyerése */
function extractPlainBody(payload: MessagePart): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const result = extractPlainBody(part);
      if (result) return result;
    }
  }
  return "";
}

/** HTML törzs kinyerése (nyers HTML string) */
function extractHtmlBody(payload: MessagePart): string {
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const result = extractHtmlBody(part);
      if (result) return result;
    }
  }
  return "";
}

/** Csatolmány metaadatok kinyerése (csak nem-inline fájlok) */
function extractAttachments(payload: MessagePart): Attachment[] {
  const result: Attachment[] = [];

  function walk(part: MessagePart) {
    const filename = part.filename;
    const attachmentId = part.body?.attachmentId;
    // Csak valódi csatolmányok — inline CID képek kihagyása
    if (filename && attachmentId && filename.length > 0) {
      result.push({
        filename,
        mimeType: part.mimeType ?? "application/octet-stream",
        size: part.body?.size ?? 0,
        attachmentId,
      });
    }
    if (part.parts) {
      for (const child of part.parts) walk(child);
    }
  }

  walk(payload);
  return result;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
