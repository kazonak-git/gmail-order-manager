function extractDomain(sender: string | null): string {
  if (!sender) return "unknown";
  const email = sender.match(/<([^>]+)>/)?.[1] ?? sender;
  const host = email.split("@")[1] ?? "";
  const parts = host.split(".");
  return parts.length >= 2 ? parts[parts.length - 2] : host || "unknown";
}

function sanitizeForFilename(s: string): string {
  return s.replace(/[^\w\s\-]/g, "").replace(/\s+/g, "_").slice(0, 60);
}

export function buildZipFilename(
  sender: string | null | undefined,
  subject: string | null | undefined,
  date: string | null | undefined,
): string {
  const domain = extractDomain(sender ?? null);
  const subjectPart = sanitizeForFilename(subject ?? "");
  const datePart = date
    ? new Date(date).toISOString().slice(2, 10) // yy-mm-dd
    : "00-00-00";
  return [domain, subjectPart, datePart].filter(Boolean).join("_") + ".zip";
}
