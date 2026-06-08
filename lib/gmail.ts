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

// Könnyű ref, amit a messages.list ad vissza (id + threadId, tartalom nélkül)
export interface GmailMessageRef {
  id: string;
  threadId: string;
}

const LOG = (...args: unknown[]) =>
  console.log("[GMAIL]", new Date().toISOString(), ...args);

const DETAIL_BATCH_SIZE = 10;
const MAX_TOTAL_MESSAGES = 2000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Csak az üzenet ID-kat és thread ID-kat gyűjti össze lapozással.
 * Gyors — nem tölt le email tartalmat.
 */
export async function listMessageRefs(
  accessToken: string,
  query: string,
): Promise<GmailMessageRef[]> {
  const gmail = getGmailClient(accessToken);

  LOG("messages.list hívás (teljes lapozással) — q:", query);

  const allRefs: GmailMessageRef[] = [];
  let pageToken: string | undefined = undefined;
  let pageNum = 0;

  do {
    pageNum++;
    LOG(`Oldal #${pageNum} lekérése${pageToken ? " (pageToken: " + pageToken.slice(0, 8) + "...)" : ""}...`);

    let listRes;
    try {
      listRes = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 500,
        ...(pageToken ? { pageToken } : {}),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const details = (err as { response?: { data?: unknown } })?.response?.data;
      LOG("HIBA — messages.list sikertelen:", msg);
      LOG("Részletek:", JSON.stringify(details ?? {}));
      throw err;
    }

    const msgs = listRes.data.messages ?? [];
    for (const m of msgs) {
      if (m.id && m.threadId) {
        allRefs.push({ id: m.id, threadId: m.threadId });
      }
    }
    LOG(`Oldal #${pageNum}: ${msgs.length} üzenet | összesen eddig: ${allRefs.length} | resultSizeEstimate: ${listRes.data.resultSizeEstimate}`);

    pageToken = listRes.data.nextPageToken ?? undefined;

    if (allRefs.length >= MAX_TOTAL_MESSAGES) {
      LOG(`Elérte a ${MAX_TOTAL_MESSAGES}-es korlátot — lapozás leállítva`);
      break;
    }
  } while (pageToken);

  LOG(`Összes üzenet ref összegyűjtve: ${allRefs.length}`);
  return allRefs;
}

/**
 * Adott ID-listához lekéri a teljes email tartalmat batch-ekben.
 */
export async function fetchEmailDetails(
  accessToken: string,
  refs: GmailMessageRef[],
): Promise<GmailMessage[]> {
  const gmail = getGmailClient(accessToken);

  if (refs.length === 0) return [];

  LOG(`Részletes lekérés batch-ekben (méret: ${DETAIL_BATCH_SIZE}), összesen: ${refs.length} levél...`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detailed: any[] = [];

  for (let i = 0; i < refs.length; i += DETAIL_BATCH_SIZE) {
    const batch = refs.slice(i, i + DETAIL_BATCH_SIZE);
    LOG(`Batch ${Math.floor(i / DETAIL_BATCH_SIZE) + 1}/${Math.ceil(refs.length / DETAIL_BATCH_SIZE)} (${batch.length} levél)...`);

    try {
      const batchResults = await Promise.all(
        batch.map((m) =>
          gmail.users.messages.get({
            userId: "me",
            id: m.id,
            format: "full",
          })
        )
      );
      detailed.push(...batchResults);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      LOG("HIBA — messages.get batch sikertelen:", msg);
      throw err;
    }

    if (i + DETAIL_BATCH_SIZE < refs.length) {
      await sleep(100);
    }
  }

  LOG(`${detailed.length} levél részletei sikeresen letöltve`);

  return detailed.map((res) => {
    const msg = res.data;
    const headers = msg.payload?.headers ?? [];
    const get = (name: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      headers.find((h: any) => h.name?.toLowerCase() === name)?.value ?? "";

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

/**
 * Visszafelé kompatibilis wrapper — egyben listáz és tölt le.
 * Csak kis mennyiségű emailnél használd.
 */
export async function fetchOrderEmails(
  accessToken: string,
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _maxResults = 50
): Promise<GmailMessage[]> {
  const refs = await listMessageRefs(accessToken, query);
  return fetchEmailDetails(accessToken, refs);
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
