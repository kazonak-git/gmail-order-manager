"use client";

interface Props {
  html?: string;        // szerver oldalon már sanitizált HTML
  plain?: string;       // plain text fallback
  subject?: string;
}

/**
 * Email tartalom megjelenítő.
 * A `html` prop szerver oldalon sanitize-html-lel már tisztított HTML —
 * így a dangerouslySetInnerHTML biztonságos.
 */
export function EmailBody({ html, plain, subject }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-border/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40">
        <h3 className="text-sm font-semibold text-[#2A2A2A]">Email tartalom</h3>
        {subject && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{subject}</p>
        )}
      </div>

      <div className="max-h-[520px] overflow-auto">
        {html ? (
          // Sanitizált HTML — biztonságos renderelés
          <div
            className="px-5 py-4 text-sm text-[#2A2A2A] leading-relaxed email-html-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : plain ? (
          // Plain text — sortörések megtartva
          <pre className="px-5 py-4 text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed bg-[#F6F6F6] rounded-b-2xl">
            {plain}
          </pre>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground italic">
            Nincs megjeleníthető email tartalom.
          </p>
        )}
      </div>
    </div>
  );
}
