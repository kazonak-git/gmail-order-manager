import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listMessageRefs, fetchEmailDetails, GmailMessage } from "@/lib/gmail";
import { parseOrderFromEmail, isOrderEmail } from "@/lib/order-parser";
import { buildGmailQuery, DEFAULT_KEYWORDS, DEFAULT_SENDERS } from "@/lib/gmail-query";
import { supabaseAdmin } from "@/lib/supabase";

const LOG = (...args: unknown[]) =>
  console.log("[SYNC]", new Date().toISOString(), ...args);

export async function POST(req: NextRequest) {
  LOG("--- Szinkronizáció elindult ---");

  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    LOG("HIBA: Nincs access token a session-ben");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  LOG("Session OK, felhasználó:", session.user.email, "| user_id:", session.user.id);

  const body = await req.json().catch(() => ({}));
  const {
    query: customQuery,
    maxResults = 100,
    syncFromDate,   // "YYYY-MM-DD" string vagy undefined
  } = body;

  // --- 1. Gmail lekérdezés felépítése ---
  let gmailQuery: string;
  if (customQuery) {
    gmailQuery = customQuery;
    LOG("Egyéni query érkezett:", gmailQuery);
  } else {
    // Felhasználó beállításaiból dinamikus query
    const { data: filterSettings } = await supabaseAdmin
      .from("user_filter_settings")
      .select("keywords, senders")
      .eq("user_id", session.user.id)
      .single();

    const keywords = filterSettings?.keywords ?? DEFAULT_KEYWORDS;
    const senders = filterSettings?.senders ?? DEFAULT_SENDERS;
    gmailQuery = buildGmailQuery(keywords, senders);
    LOG("Dinamikus query felépítve (", keywords.length, "kulcsszó,", senders.length, "feladó):", gmailQuery);
  }

  // Dátumszűrő hozzáadása (YYYY-MM-DD → YYYY/MM/DD a Gmail szintaxishoz)
  let fullQuery = gmailQuery;
  if (syncFromDate && /^\d{4}-\d{2}-\d{2}$/.test(syncFromDate)) {
    const afterStr = syncFromDate.replace(/-/g, "/");
    fullQuery = `${gmailQuery} after:${afterStr}`;
    LOG("Dátumszűrő hozzáadva:", afterStr);
  } else {
    LOG("Nincs dátumszűrő — összes levél vizsgálata");
  }

  LOG("Végleges Gmail lekérdezés:", fullQuery);
  LOG("Max. eredmény:", maxResults);

  // Sync log létrehozása
  const { data: logData, error: logError } = await supabaseAdmin
    .from("sync_logs")
    .insert({
      started_at: new Date().toISOString(),
      emails_scanned: 0,
      orders_found: 0,
      status: "running",
      user_id: session.user.id,
    })
    .select()
    .single();

  if (logError) {
    LOG("FIGYELMEZTETÉS: Sync log létrehozása sikertelen:", logError.message);
  } else {
    LOG("Sync log létrehozva, ID:", logData?.id);
  }

  const logId = logData?.id;

  try {
    // --- 1. Már feldolgozott message ID-k ÉS thread ID-k lekérése (DB) ---
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("orders")
      .select("gmail_message_id, gmail_thread_id")
      .eq("user_id", session.user.id);

    if (existingError) {
      LOG("HIBA: Meglévő rendelések lekérdezése sikertelen:", existingError.message);
    }

    const existingMessageIds = new Set((existing ?? []).map((o) => o.gmail_message_id));
    const existingThreadIds = new Set(
      (existing ?? []).map((o) => o.gmail_thread_id).filter(Boolean)
    );
    LOG(`DB-ben lévő message ID-k: ${existingMessageIds.size}, thread ID-k: ${existingThreadIds.size}`);

    // --- 2. Csak ID-k + threadId-k lekérése Gmail API-tól (tartalom nélkül, gyors) ---
    LOG("Gmail API hívás indítása (csak ID-k)...");
    const allRefs = await listMessageRefs(session.accessToken, fullQuery);
    LOG(`Gmail API válasz: ${allRefs.length} üzenet ref`);

    // --- 3. Szűrés és thread dedup az ID-k szintjén (tartalom letöltése előtt) ---
    const unseenRefs = allRefs.filter((r) => !existingMessageIds.has(r.id));
    LOG(`Már feldolgozott message ID-k kiszűrve: ${allRefs.length - unseenRefs.length} | Marad: ${unseenRefs.length}`);

    const newThreadRefs = unseenRefs.filter((r) => !existingThreadIds.has(r.threadId));
    LOG(`Már feldolgozott thread ID-k kiszűrve: ${unseenRefs.length - newThreadRefs.length} | Marad: ${newThreadRefs.length}`);

    // Threaden belül csak a legkorábban érkező ref marad (ID-k szerint — a Gmail legújabbat adja először, tehát az utolsó az ID-listában a legkorábbi)
    const threadMap = new Map<string, typeof newThreadRefs[0]>();
    for (let i = newThreadRefs.length - 1; i >= 0; i--) {
      const r = newThreadRefs[i];
      threadMap.set(r.threadId, r);
    }
    // Gmail a legújabbakat adja először — megfordítjuk, hogy a legrégebbieket dolgozzuk fel először
    const dedupedRefs = Array.from(threadMap.values()).reverse();
    LOG(`Thread dedup után: ${dedupedRefs.length} egyedi új levél`);

    if (dedupedRefs.length === 0) {
      LOG("Nincs új feldolgozandó levél — szinkronizáció kész");
      if (logId) {
        await supabaseAdmin.from("sync_logs").update({
          finished_at: new Date().toISOString(),
          emails_scanned: allRefs.length,
          orders_found: 0,
          status: "done",
        }).eq("id", logId);
      }
      return NextResponse.json({ success: true, emails_scanned: allRefs.length, orders_found: 0, new_orders: 0, remaining: 0 });
    }

    // Egy menetben max 75 levél tartalmát töltjük le (Vercel timeout + sebesség)
    // Ha több van, a következő szinkronizáció folytatja
    const BATCH_LIMIT = 75;
    const toProcess = dedupedRefs.slice(0, BATCH_LIMIT);
    const remaining = Math.max(0, dedupedRefs.length - BATCH_LIMIT);
    if (remaining > 0) {
      LOG(`Egy menetben max ${BATCH_LIMIT} levél — ${remaining} levél a következő szinkronra marad`);
    }

    // --- 4. Csak az új levelek teljes tartalmának letöltése ---
    LOG(`Tartalom letöltése ${toProcess.length} új levélhez...`);
    const emails = await fetchEmailDetails(session.accessToken, toProcess);
    LOG(`${emails.length} levél tartalma letöltve`);

    if (emails.length > 0) {
      LOG("Első 3 levél preview:");
      emails.slice(0, 3).forEach((e, i) => {
        LOG(`  [${i + 1}] ID: ${e.id} | Tárgy: "${e.subject}" | Feladó: ${e.from}`);
      });
    }

    // --- 5. App-oldali relevancia szűrés ---
    const relevantEmails = emails.filter((e) => isOrderEmail(e.subject, e.body));
    LOG(`Relevancia szűrés után: ${relevantEmails.length} levél (${emails.length - relevantEmails.length} kiszűrve)`);

    // --- 5. Parse + mentés ---
    const parsed = relevantEmails.map((e) => parseOrderFromEmail(e));

    let ordersFound = 0;
    if (parsed.length > 0) {
      LOG(`${parsed.length} rendelés mentése Supabase-be (batch-ekben)...`);
      const toInsert = parsed.map((p) => ({ ...p, user_id: session.user.id }));
      const SUPABASE_BATCH = 50;
      for (let i = 0; i < toInsert.length; i += SUPABASE_BATCH) {
        const batch = toInsert.slice(i, i + SUPABASE_BATCH);
        LOG(`Supabase batch ${Math.floor(i / SUPABASE_BATCH) + 1}/${Math.ceil(toInsert.length / SUPABASE_BATCH)} (${batch.length} sor)...`);
        const { error: insertError } = await supabaseAdmin.from("orders").insert(batch);
        if (insertError) {
          LOG("HIBA: Supabase insert sikertelen:", insertError.message);
        } else {
          ordersFound += batch.length;
        }
      }
      LOG(`${ordersFound} rendelés sikeresen elmentve`);
    } else {
      LOG("Nincs új mentendő rendelés");
    }

    // Log lezárása
    if (logId) {
      await supabaseAdmin
        .from("sync_logs")
        .update({
          finished_at: new Date().toISOString(),
          emails_scanned: allRefs.length,
          orders_found: ordersFound,
          status: "done",
        })
        .eq("id", logId);
    }

    LOG(`--- Szinkronizáció kész: ${allRefs.length} email átvizsgálva, ${ordersFound} új rendelés ---`);

    return NextResponse.json({
      success: true,
      emails_scanned: allRefs.length,
      orders_found: ordersFound,
      new_orders: ordersFound,
      remaining,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : "";
    LOG("KRITIKUS HIBA:", message);
    LOG("Stack trace:", stack);

    if (logId) {
      await supabaseAdmin
        .from("sync_logs")
        .update({
          finished_at: new Date().toISOString(),
          status: "error",
          error_message: message,
        })
        .eq("id", logId);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Thread-alapú deduplikáció:
 * - Ha a threadId már szerepel az adatbázisban → kihagyja az egész threadet
 * - Ha ugyanabból a threadből több levél is jön → csak a legkorábbi dátumú marad
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function deduplicateByThread(
  emails: GmailMessage[],
  existingThreadIds: Set<string>
): GmailMessage[] {
  // Kiszűrjük azokat, amelyek thread-je már az adatbázisban van
  const newThreadEmails = emails.filter((e) => !existingThreadIds.has(e.threadId));

  // Threaden belül csak a legkorábbi email marad
  const threadMap = new Map<string, GmailMessage>();
  for (const email of newThreadEmails) {
    const existing = threadMap.get(email.threadId);
    if (!existing) {
      threadMap.set(email.threadId, email);
    } else {
      // Összehasonlítjuk a dátumokat — a korábbi marad
      const existingDate = new Date(existing.date).getTime();
      const currentDate = new Date(email.date).getTime();
      if (!isNaN(currentDate) && (isNaN(existingDate) || currentDate < existingDate)) {
        threadMap.set(email.threadId, email);
      }
    }
  }

  return Array.from(threadMap.values());
}
