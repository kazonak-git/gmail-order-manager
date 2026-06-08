export const DEFAULT_KEYWORDS = [
  "rendel",
  "visszaigazol",
  "confirm",
  "order",
  "megrendelés",
  "megrendelése",
  "megrendelésed",
  "invoice",
  "receipt",
  "számla",
  "számlád",
  "számládat",
  "purchase",
  "vásárlás",
  "vásárlásod",
  "deliver",
  "delivery",
  "fizetés",
  "payment",
  "köszönjük",
  "csomag",
];

export const DEFAULT_SENDERS = [
  "emag",
  "alza",
  "decathlon",
  "amazon",
  "myprotein",
  "ikea",
  "euronics",
  "mediamarkt",
  "notebook.hu",
  "foxpost",
  "gls",
  "dpd",
  "sprinter",
];

/**
 * Gmail keresési lekérdezést épít a kulcsszavak és feladók listájából.
 * Eredmény pl.:
 *   subject:(rendel OR confirm OR order) OR from:(emag OR amazon)
 */
export function buildGmailQuery(keywords: string[], senders: string[]): string {
  const subjectPart =
    keywords.length > 0 ? `subject:(${keywords.join(" OR ")})` : "";
  const fromPart =
    senders.length > 0 ? `from:(${senders.join(" OR ")})` : "";
  return [subjectPart, fromPart].filter(Boolean).join(" OR ");
}
