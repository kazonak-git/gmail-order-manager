import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { OrderStatusSelect } from "@/components/order-status-select";
import { EmailBody } from "@/components/email-body";
import { BackButton } from "@/components/back-button";
import { Mail, Package, CreditCard, Paperclip, Download } from "lucide-react";
import { buildZipFilename } from "@/lib/zip-filename";
import type { Order, OrderItem, Attachment } from "@/types/database";
import sanitizeHtml from "sanitize-html";

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  new:  { label: "Új",          color: "#7BB27E", bg: "#E8F5E9" },
  done: { label: "Feldolgozott", color: "#9575CD", bg: "#EDE7F6" },
};

function InfoCard({ title, icon: Icon, children, accentColor = "#7BB27E" }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-border/50 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/40">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accentColor}20` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
        </div>
        <h3 className="text-sm font-semibold text-[#2A2A2A]">{title}</h3>
      </div>
      <div className="px-5 py-4 text-sm space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-[#2A2A2A] text-right">{value ?? "—"}</span>
    </div>
  );
}

/** Szerver-oldali HTML sanitizálás:
 * - XSS-veszélyes tagek és attribútumok eltávolítása
 * - cid: hivatkozások (inline képek) kihagyása
 * - Külső képek megengedve, de csak https
 */
function sanitizeEmailHtml(raw: string): string {
  return sanitizeHtml(raw, {
    allowedTags: [
      "a", "b", "br", "blockquote", "caption", "cite", "code",
      "col", "colgroup", "dd", "del", "details", "div", "dl", "dt",
      "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6",
      "hr", "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "pre",
      "q", "s", "small", "span", "strong", "sub", "summary", "sup",
      "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr",
      "u", "ul",
    ],
    allowedAttributes: {
      "*": ["style", "class", "align", "valign", "width", "height", "bgcolor", "color"],
      "a": ["href", "title", "target", "rel"],
      "img": ["src", "alt", "title", "width", "height"],
      "td": ["colspan", "rowspan"],
      "th": ["colspan", "rowspan", "scope"],
      "col": ["span"],
      "colgroup": ["span"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    // cid: inline képek kihagyása (törött kép helyett semmi)
    transformTags: {
      img: (tagName, attribs) => {
        if (attribs.src?.startsWith("cid:")) {
          return { tagName: "span", attribs: {} }; // inline kép → üres span
        }
        return { tagName, attribs };
      },
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
    },
  });
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const { data: rawOrder } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", session!.user.id)
    .single();

  if (!rawOrder) notFound();
  const o = rawOrder as unknown as Order;
  const items = (o.items ?? []) as OrderItem[];
  const attachments = (o.attachments ?? []) as Attachment[];
  const st = STATUS[o.status] ?? { label: o.status, color: "#999", bg: "#f5f5f5" };

  // HTML sanitizálás szerver oldalon
  const safeHtml = o.raw_email_html ? sanitizeEmailHtml(o.raw_email_html) : undefined;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Fejléc */}
      <div className="flex items-start gap-4">
        <BackButton />
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-[#2A2A2A]">
              {o.customer_name ?? "Ismeretlen vásárló"}
            </h1>
            {o.order_number && (
              <span className="font-mono text-sm text-muted-foreground">#{o.order_number}</span>
            )}
            <span className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ color: st.color, background: st.bg }}>
              {st.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {o.order_date ? new Date(o.order_date).toLocaleString("hu-HU") : "Ismeretlen dátum"}
          </p>
        </div>
      </div>

      <OrderStatusSelect orderId={o.id} currentStatus={o.status} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard title="Vásárló adatok" icon={Mail} accentColor="#7BB27E">
          <Field label="Név" value={o.customer_name} />
          <Field label="Email" value={o.customer_email} />
          <Field label="Forrás" value={o.source_sender} />
        </InfoCard>

        <InfoCard title="Fizetés" icon={CreditCard} accentColor="#9575CD">
          <Field label="Összeg" value={o.total_amount ? `${o.total_amount.toLocaleString("hu-HU")} ${o.currency}` : undefined} />
          <Field label="Módszer" value={o.payment_method} />
        </InfoCard>


        {items.length > 0 && (
          <InfoCard title="Termékek" icon={Package} accentColor="#FFB74D">
            <div className="divide-y divide-border/30 -mx-5">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between px-5 py-2">
                  <span className="text-[#2A2A2A]">{item.name} <span className="text-muted-foreground text-xs">×{item.quantity}</span></span>
                  <span className="font-semibold text-[#2A2A2A]">{item.total_price?.toLocaleString("hu-HU")} {o.currency}</span>
                </div>
              ))}
            </div>
          </InfoCard>
        )}
      </div>

      {/* Csatolmányok */}
      {attachments.length > 0 && (
        <div className="bg-white rounded-2xl shadow-soft border border-border/50 overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/40">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#FFF3E020" }}>
              <Paperclip className="w-3.5 h-3.5" style={{ color: "#FFB74D" }} />
            </div>
            <h3 className="text-sm font-semibold text-[#2A2A2A]">Csatolmányok</h3>
            <span className="text-xs text-muted-foreground">({attachments.length} fájl)</span>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs border border-border/50 bg-[#F6F6F6]"
                >
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium text-[#2A2A2A]">{a.filename}</span>
                  {a.size > 0 && (
                    <span className="text-muted-foreground">
                      {a.size > 1024 * 1024
                        ? `${(a.size / 1024 / 1024).toFixed(1)} MB`
                        : `${Math.round(a.size / 1024)} KB`}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <a
              href={`/api/orders/${o.id}/attachments`}
              download={buildZipFilename(o.source_sender, o.raw_email_subject, o.order_date)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-[#FFB74D]/60 text-[#E65100] bg-[#FFF3E0] hover:bg-[#FFE0B2] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              ZIP letöltése
            </a>
          </div>
        </div>
      )}

      {/* Email tartalom */}
      {(safeHtml || o.raw_email_body) && (
        <EmailBody
          html={safeHtml}
          plain={safeHtml ? undefined : o.raw_email_body}
          subject={o.raw_email_subject}
        />
      )}
    </div>
  );
}
