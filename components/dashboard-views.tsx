"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Attachment } from "@/types/database";
import { buildZipFilename } from "@/lib/zip-filename";

// ─── Típusok ────────────────────────────────────────────────────────────────

interface OrderRow {
  id: string;
  source_sender?: string;
  raw_email_subject?: string;
  raw_email_body?: string;
  email_type?: string;
  attachments?: Attachment[];
  order_number?: string;
  order_date?: string;
  total_amount?: number;
  currency?: string;
  status: string;
  customer_name?: string;
  customer_email?: string;
}

// ─── Színek ─────────────────────────────────────────────────────────────────

const WEBSHOP_COLORS = [
  { bg: "#E8F5E9", color: "#2A6E3A" },
  { bg: "#EDE7F6", color: "#4527A0" },
  { bg: "#E3F2FD", color: "#0D47A1" },
  { bg: "#FFF3E0", color: "#E65100" },
  { bg: "#FCE4EC", color: "#B71C1C" },
  { bg: "#F3E5F5", color: "#6A1B9A" },
  { bg: "#E0F7FA", color: "#006064" },
  { bg: "#F9FBE7", color: "#558B2F" },
];

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  new:  { label: "Új",          color: "#7BB27E", bg: "#E8F5E9" },
  done: { label: "Feldolgozott", color: "#9575CD", bg: "#EDE7F6" },
};

// ─── Segédfüggvény ───────────────────────────────────────────────────────────

function extractDomain(sourceSender?: string): string {
  if (!sourceSender) return "egyéb";
  const emailMatch = sourceSender.match(/<([^>]+)>/) ?? sourceSender.match(/([^\s<]+@[^\s>]+)/);
  const email = emailMatch?.[1] ?? sourceSender;
  const domainPart = email.split("@")[1] ?? "";
  const parts = domainPart.split(".");
  if (parts.length >= 2) return parts[parts.length - 2].toLowerCase();
  return domainPart.toLowerCase() || "egyéb";
}

// ─── Inline státusz select ───────────────────────────────────────────────────

function InlineStatusSelect({ orderId, initialStatus }: { orderId: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const st = STATUS_LABELS[status] ?? { color: "#999", bg: "#f5f5f5" };

  async function handleChange(newStatus: string) {
    setSaving(true);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setStatus(newStatus);
      toast.success("Státusz frissítve");
    } else {
      toast.error("Hiba a mentés során");
    }
    setSaving(false);
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={status} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger
          className="h-7 text-[11px] font-semibold px-2.5 rounded-full border-0 focus:ring-1 focus:ring-offset-0 w-auto gap-1"
          style={{ color: st.color, background: st.bg }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Mini rendelés lista ─────────────────────────────────────────────────────

function OrderList({ orders, onDeleted }: { orders: OrderRow[]; onDeleted: (id: string) => void }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Biztosan törlöd ezt a levelet?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Levél törölve");
      onDeleted(id);
    } else {
      toast.error("Hiba a törlés során");
    }
    setDeletingId(null);
  }

  if (orders.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-center text-muted-foreground">
        Nincs ide sorolható rendelés.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {orders.map((o) => (
        <div
          key={o.id}
          className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-[#F6F6F6] transition-colors"
          onClick={() => router.push(`/orders/${o.id}`)}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#2A2A2A] truncate">
              {o.raw_email_subject ?? o.customer_name ?? o.customer_email ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {o.source_sender ?? "—"}
              {o.order_date && (
                <> · {new Date(o.order_date).toLocaleDateString("hu-HU")}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {o.total_amount != null && (
              <span className="text-sm font-bold text-[#2A2A2A]">
                {o.total_amount.toLocaleString("hu-HU")} {o.currency ?? "HUF"}
              </span>
            )}
            {(o.attachments ?? []).length > 0 && (
              <a
                href={`/api/orders/${o.id}/attachments`}
                download={buildZipFilename(o.source_sender, o.raw_email_subject, o.order_date)}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-[#FFB74D]/50 text-[#E65100] bg-[#FFF3E0] hover:bg-[#FFE0B2] transition-colors"
                title="Csatolmányok letöltése"
              >
                <Download className="w-3 h-3" />
                {(o.attachments as Attachment[]).length}
              </a>
            )}
            <InlineStatusSelect orderId={o.id} initialStatus={o.status} />
            <button
              onClick={(e) => handleDelete(e, o.id)}
              disabled={deletingId === o.id}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
              title="Levél törlése"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Monogram kártya ─────────────────────────────────────────────────────────

function CategoryCard({
  label, count, lastDate, bg, color, open, onClick,
}: {
  label: string; count: number; lastDate?: string; bg: string; color: string; open: boolean; onClick: () => void;
}) {
  const monogram = label.slice(0, 2).toUpperCase();
  const formattedDate = lastDate
    ? new Date(lastDate).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })
    : null;

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-soft text-left transition-all hover:shadow-md active:scale-[0.99] w-full border"
      style={{
        borderColor: open ? color + "60" : "transparent",
        outline: open ? `2px solid ${color}30` : "none",
      }}
    >
      {/* Monogram */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-extrabold shrink-0 tracking-tight"
        style={{ background: bg, color }}
      >
        {monogram}
      </div>
      {/* Szöveg */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#2A2A2A] truncate uppercase tracking-wide leading-tight">
          {label}
        </p>
        {formattedDate && (
          <p className="text-xs text-muted-foreground mt-0.5">legutóbb {formattedDate}</p>
        )}
      </div>
      {/* Szám */}
      <p className="text-2xl font-extrabold text-[#2A2A2A] shrink-0">{count}</p>
    </button>
  );
}

// ─── Főkomponens ─────────────────────────────────────────────────────────────

export function DashboardViews({ orders: initialOrders }: { orders: OrderRow[] }) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Webshop szerinti csoportosítás, darabszám szerint rendezve
  const webshopMap = new Map<string, OrderRow[]>();
  for (const o of orders) {
    const domain = extractDomain(o.source_sender);
    if (!webshopMap.has(domain)) webshopMap.set(domain, []);
    webshopMap.get(domain)!.push(o);
  }
  const webshopGroups = Array.from(webshopMap.entries())
    .sort(([, a], [, b]) => b.length - a.length);

  function toggle(key: string) {
    setOpenKey((prev) => (prev === key ? null : key));
  }

  function getLastDate(domainOrders: OrderRow[]): string | undefined {
    const dates = domainOrders.map((o) => o.order_date).filter(Boolean).sort().reverse();
    return dates[0] ?? undefined;
  }

  function handleOrderDeleted(id: string) {
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== id);
      // Ha a csoport üres lett, zárjuk be
      const remaining = next.filter((o) => extractDomain(o.source_sender) === openKey);
      if (remaining.length === 0) setOpenKey(null);
      return next;
    });
  }

  async function handleGroupDelete(domain: string, domainOrders: OrderRow[]) {
    if (!confirm(`Biztosan törlöd az összes ${domain} levelet? (${domainOrders.length} db)`)) return;
    setDeletingGroup(true);
    const ids = domainOrders.map((o) => o.id);
    const res = await fetch("/api/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (res.ok) {
      toast.success(`${ids.length} levél törölve`);
      setOrders((prev) => prev.filter((o) => !ids.includes(o.id)));
      setOpenKey(null);
    } else {
      toast.error("Hiba a törlés során");
    }
    setDeletingGroup(false);
  }

  const openIdx = openKey ? webshopGroups.findIndex(([d]) => d === openKey) : -1;
  const openColor = openIdx >= 0 ? WEBSHOP_COLORS[openIdx % WEBSHOP_COLORS.length] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Kártya grid — csak akkor látszik, ha nincs nyitva semmi */}
      {!openKey && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {webshopGroups.map(([domain, domainOrders], idx) => {
            const c = WEBSHOP_COLORS[idx % WEBSHOP_COLORS.length];
            return (
              <CategoryCard
                key={domain}
                label={domain}
                count={domainOrders.length}
                lastDate={getLastDate(domainOrders)}
                bg={c.bg}
                color={c.color}
                open={false}
                onClick={() => toggle(domain)}
              />
            );
          })}
        </div>
      )}

      {/* Kibontott nézet — a többi kártya eltűnik, csak ez látszik */}
      {openKey && webshopMap.has(openKey) && openColor && (
        <div className="bg-white rounded-2xl shadow-soft border border-border/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 flex items-center gap-4">
            {/* Vissza gomb */}
            <button
              onClick={() => setOpenKey(null)}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 hover:bg-[#F6F6F6] transition-colors"
              title="Vissza"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="#2A2A2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {/* Monogram */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold shrink-0"
              style={{ background: openColor.bg, color: openColor.color }}
            >
              {openKey.slice(0, 2).toUpperCase()}
            </div>
            {/* Cím */}
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-[#2A2A2A] uppercase tracking-wide truncate">{openKey}</p>
              <p className="text-xs text-muted-foreground">{webshopMap.get(openKey)!.length} levél</p>
            </div>
            {/* Csoport törlése */}
            <button
              onClick={() => handleGroupDelete(openKey, webshopMap.get(openKey)!)}
              disabled={deletingGroup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Összes törlése</span>
            </button>
          </div>
          <div>
            <OrderList orders={webshopMap.get(openKey)!} onDeleted={handleOrderDeleted} />
          </div>
        </div>
      )}
    </div>
  );
}
