import type { GmailMessage } from "./gmail";
import type { Order, OrderItem, ShippingAddress, Attachment } from "@/types/database";

export const ORDER_PATTERNS = [
  /rendel/i,
  /visszaigazol/i,
  /confirm/i,
  /order/i,
  /száml/i,
  /invoice/i,
  /receipt/i,
  /vásárl/i,
  /purchase/i,
  /szállít/i,
  /deliver/i,
  /fizetés/i,
  /payment/i,
  /köszönjük/i,
  /csomag/i,
];

/**
 * Megvizsgálja, hogy az email tárgya vagy törzse rendeléshez kapcsolódik-e.
 * Ha egyik mintára sem illeszkedik → nem érdemes elmenteni.
 */
export function isOrderEmail(subject: string, body: string): boolean {
  const haystack = subject + " " + body;
  return ORDER_PATTERNS.some((p) => p.test(haystack));
}

export interface ParsedOrder
  extends Omit<Order, "id" | "created_at" | "user_id" | "status"> {
  status: "new" | "manual";
}

/**
 * Az email tárgyából/törzséből és csatolmányaiból meghatározza az email típusát.
 * - confirmation: rendelés-visszaigazolás
 * - invoice: számla (kulcsszó vagy PDF csatolmány alapján)
 * - other: egyik sem
 */
export function classifyEmailType(
  subject: string,
  body: string,
  attachments?: Array<{ mimeType?: string; filename?: string }>
): "confirmation" | "invoice" | "other" {
  const text = `${subject} ${body}`.toLowerCase();

  const hasPdf = (attachments ?? []).some(
    (a) => a.mimeType === "application/pdf" || a.filename?.toLowerCase().endsWith(".pdf")
  );
  if (hasPdf || /száml|invoice|receipt|nyugta/.test(text)) return "invoice";
  if (/visszaigazol|confirm|rendel|order|köszönjük|vásárl|purchase/.test(text)) return "confirmation";
  return "other";
}

export function parseOrderFromEmail(msg: GmailMessage): ParsedOrder {
  // Limitáljuk a feldolgozott szöveget — a regex-ek csak az első 5000 karakteren futnak
  // Ez megelőzi a katasztrofális backtracking-et nagy HTML emaileknél
  const rawText = msg.body || msg.snippet;
  const text = rawText.slice(0, 5000);

  return {
    gmail_message_id: msg.id,
    gmail_thread_id: msg.threadId,
    order_number: extractOrderNumber(text, msg.subject),
    order_date: parseEmailDate(msg.date),
    customer_name: extractCustomerName(text),
    customer_email: extractCustomerEmail(text, msg.from),
    total_amount: extractTotalAmount(text),
    currency: extractCurrency(text),
    items: extractItems(text),
    shipping_address: extractShippingAddress(text),
    payment_method: extractPaymentMethod(text),
    raw_email_subject: msg.subject,
    raw_email_body: text.slice(0, 10000),
    raw_email_html: msg.htmlBody ? msg.htmlBody.slice(0, 100000) : undefined,
    attachments: msg.attachments.length > 0 ? msg.attachments : undefined,
    email_type: classifyEmailType(msg.subject, text, msg.attachments as Attachment[]),
    source_sender: msg.from,
    parsed_at: new Date().toISOString(),
    status: "new",
  };
}

function extractOrderNumber(text: string, subject: string): string | undefined {
  const patterns = [
    /rendelés(?:szám)?[:\s#]*([A-Z0-9\-_]{4,20})/i,
    /order\s*(?:number|#|id|no\.?)[:\s]*([A-Z0-9\-_]{4,20})/i,
    /#\s*([A-Z0-9\-_]{4,20})/i,
    /(\d{4,10})/,
  ];
  for (const p of patterns) {
    const m = (subject + "\n" + text).match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

function parseEmailDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return undefined;
}

function extractCustomerName(text: string): string | undefined {
  const patterns = [
    /(?:vásárló|név|customer|name|billing name)[:\s]+([A-ZÁÉÍÓÖŐÚÜŰa-záéíóöőúüű][^\n,]{2,40})/i,
    /(?:dear|kedves)\s+([A-ZÁÉÍÓÖŐÚÜŰa-záéíóöőúüű][^\n,!]{2,30})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

function extractCustomerEmail(text: string, from: string): string | undefined {
  // Feladó emailből
  const fromMatch = from.match(/<([^>]+@[^>]+)>/);
  if (fromMatch?.[1]) return fromMatch[1].toLowerCase();

  // Szövegből
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return emailMatch?.[0]?.toLowerCase();
}

function extractTotalAmount(text: string): number | undefined {
  const patterns = [
    /(?:végösszeg|total|összesen|grand total|fizetendő)[:\s]*([0-9.,]+(?:\s[0-9.,]+)?)\s*(?:ft|huf|eur|usd|€|\$)?/i,
    /([0-9.,]+(?:\s[0-9.,]+)?)\s*(?:ft|huf)\b/i,
    /(?:€|\$)\s*([0-9.,]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const num = parseFloat(m[1].replace(/\s/g, "").replace(",", "."));
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return undefined;
}

function extractCurrency(text: string): string {
  if (/\beur\b|€/i.test(text)) return "EUR";
  if (/\busd\b|\$/i.test(text)) return "USD";
  if (/\bhuf\b|\bft\b/i.test(text)) return "HUF";
  return "HUF";
}

function extractItems(text: string): OrderItem[] {
  const items: OrderItem[] = [];
  // Általános terméksor minta: "termék neve | 2 db | 5000 Ft"
  const linePattern =
    /(.{3,50}?)\s*[|\t]\s*(\d+)\s*(?:db|pcs|x)?\s*[|\t]\s*([0-9.,]+)\s*(?:ft|huf|eur)?/gi;
  let m;
  while ((m = linePattern.exec(text)) !== null) {
    const qty = parseInt(m[2]);
    const price = parseFloat(m[3].replace(/\s/g, "").replace(",", "."));
    if (!isNaN(qty) && !isNaN(price) && price > 0) {
      items.push({
        name: m[1].trim(),
        quantity: qty,
        unit_price: price / qty,
        total_price: price,
      });
    }
  }
  return items;
}

function extractShippingAddress(text: string): ShippingAddress | undefined {
  const zipCityMatch = text.match(/(\d{4})\s+([A-ZÁÉÍÓÖŐÚÜŰa-záéíóöőúüű][^\n,]{2,30})/);
  const streetMatch = text.match(
    /([A-ZÁÉÍÓÖŐÚÜŰa-záéíóöőúüű][^\n,]{3,50}(?:utca|út|tér|krt|körút|sor|köz|dűlő)[^\n,]{0,20})/i
  );
  if (!zipCityMatch && !streetMatch) return undefined;
  return {
    zip: zipCityMatch?.[1],
    city: zipCityMatch?.[2]?.trim(),
    street: streetMatch?.[1]?.trim(),
    country: "HU",
  };
}

function extractPaymentMethod(text: string): string | undefined {
  if (/bankkártya|card|online fizet/i.test(text)) return "card";
  if (/átutalás|transfer|utalás/i.test(text)) return "transfer";
  if (/utánvét|cod|cash on delivery/i.test(text)) return "cod";
  if (/paypal/i.test(text)) return "paypal";
  if (/simplepay|barion|stripe/i.test(text)) return "online";
  return undefined;
}
