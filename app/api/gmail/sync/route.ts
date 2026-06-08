import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchOrderEmails, GmailMessage } from "@/lib/gmail";
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
    LOG("Gmail API hívás indítása...");
    const emails = await fetchOrderEmails(session.accessToken, fullQuery, maxResults);
    LOG(`Gmail API válasz: ${emails.length} levél találva`);

    if (emails.length > 0) {
      LOG("Első 3 levél preview:");
      emails.slice(0, 3).forEach((e, i) => {
        LOG(`  [${i + 1}] ID: ${e.id} | Tárgy: "${e.subject}" | Feladó: ${e.from}`);
      });
    }

    // --- 2. Már feldolgozott message ID-k ÉS thread ID-k lekérése ---
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

    // Üzenet-ID alapú szűrés (már feldolgozott üzenetek kihagyása)
    const unseenEmails = emails.filter((e) => !existingMessageIds.has(e.id));
    LOG(`Már feldolgozott message ID-k: ${existingMessageIds.size} | Új levelek message-ID alapján: ${unseenEmails.length}`);

    // --- 3. Thread-alapú deduplikáció ---
    // Ha egy thread már szerepel az adatbázisban → kihagyja
    // Ha ugyanabból a threadből több levél is jön → csak a legkorábbi marad
    const afterThreadDedup = deduplicateByThread(unseenEmails, existingThreadIds);
    LOG(`Thread dedup után: ${afterThreadDedup.length} levél maradt ${unseenEmails.length} helyett`);

    // --- 4. App-oldali relevancia szűrés ---
    const relevantEmails = afterThreadDedup.filter((e) => isOrderEmail(e.subject, e.body));
    LOG(`Relevancia szűrés után: ${relevantEmails.length} levél (${afterThreadDedup.length - relevantEmails.length} kiszűrve)`);

    // --- 5. Parse + mentés ---
    const parsed = relevantEmails.map((e) => parseOrderFromEmail(e));

    let ordersFound = 0;
    if (parsed.length > 0) {
      LOG(`${parsed.length} rendelés mentése Supabase-be...`);
      const toInsert = parsed.map((p) => ({ ...p, user_id: session.user.id }));
      const { error: insertError } = await supabaseAdmin.from("orders").insert(toInsert);
      if (insertError) {
        LOG("HIBA: Supabase insert sikertelen:", insertError.message);
      } else {
        ordersFound = parsed.length;
        LOG(`${ordersFound} rendelés sikeresen elmentve`);
      }
    } else {
      LOG("Nincs új mentendő rendelés");
    }

    // Log lezárása
    if (logId) {
      await supabaseAdmin
        .from("sync_logs")
        .update({
          finished_at: new Date().toISOString(),
          emails_scanned: emails.length,
          orders_found: ordersFound,
          status: "done",
        })
        .eq("id", logId);
    }

    LOG(`--- Szinkronizáció kész: ${emails.length} email, ${ordersFound} új rendelés ---`);

    return NextResponse.json({
      success: true,
      emails_scanned: emails.length,
      orders_found: ordersFound,
      new_orders: ordersFound,
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
