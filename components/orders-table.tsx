"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Search, ChevronLeft, ChevronRight, FileText, FileSpreadsheet, Image, File, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Order, Attachment, OrderStatus } from "@/types/database";
import { buildZipFilename } from "@/lib/zip-filename";

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  new:  { label: "Új",          color: "#7BB27E", bg: "#E8F5E9" },
  done: { label: "Feldolgozott", color: "#9575CD", bg: "#EDE7F6" },
};

function extractEmail(sender?: string | null): string {
  if (!sender) return "—";
  const match = sender.match(/<([^>]+)>/);
  return match ? match[1] : sender.trim();
}

function AttachmentIcon({ attachment }: { attachment: Attachment }) {
  const { filename, mimeType } = attachment;
  const lower = filename.toLowerCase();
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    return (
      <span title={filename} className="inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold text-white" style={{ background: "#E53935" }}>PDF</span>
    );
  }
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) {
    return <span title={filename}><FileText className="w-4 h-4" style={{ color: "#1565C0" }} /></span>;
  }
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) {
    return <span title={filename}><FileSpreadsheet className="w-4 h-4" style={{ color: "#2E7D32" }} /></span>;
  }
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].some((e) => lower.endsWith(e))) {
    return <span title={filename}><Image className="w-4 h-4 text-[#757575]" /></span>;
  }
  return <span title={filename}><File className="w-4 h-4 text-[#9E9E9E]" /></span>;
}

function InlineStatusSelect({ orderId, initialStatus, onUpdated }: {
  orderId: string;
  initialStatus: string;
  onUpdated: (newStatus: string) => void;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);

  async function handleChange(newStatus: string) {
    setSaving(true);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setStatus(newStatus);
      onUpdated(newStatus);
      toast.success("Státusz frissítve");
    } else {
      toast.error("Hiba a mentés során");
    }
    setSaving(false);
  }

  const st = STATUS[status] ?? { color: "#999", bg: "#f5f5f5" };

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
          {Object.entries(STATUS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function OrdersTable() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(search && { search }),
      ...(statusFilter !== "all" && { status: statusFilter }),
    });
    const res = await fetch(`/api/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  function updateOrderStatus(id: string, newStatus: string) {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: newStatus as OrderStatus } : o));
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === orders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map((o) => o.id)));
    }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Biztosan törlöd a kiválasztott ${selected.size} levelet?`)) return;
    setDeleting(true);
    const res = await fetch("/api/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    if (res.ok) {
      toast.success(`${selected.size} levél törölve`);
      setSelected(new Set());
      fetchOrders();
    } else {
      toast.error("Hiba a törlés során");
    }
    setDeleting(false);
  }

  async function handleDeleteOne(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Biztosan törlöd ezt a levelet?")) return;
    const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Levél törölve");
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
      fetchOrders();
    } else {
      toast.error("Hiba a törlés során");
    }
  }

  const exportUrl = `/api/export?${new URLSearchParams({ ...(statusFilter !== "all" && { status: statusFilter }) })}`;
  const totalPages = Math.ceil(total / pageSize);
  const allSelected = orders.length > 0 && selected.size === orders.length;

  return (
    <div className="space-y-4">
      {/* Szűrők */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Keresés feladó, email, tárgy..."
            className="pl-9 bg-white rounded-xl border-border/60 focus-visible:ring-[#7BB27E]"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44 bg-white rounded-xl border-border/60">
            <SelectValue placeholder="Státusz" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes státusz</SelectItem>
            {Object.entries(STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <a
          href={exportUrl}
          download
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-border/60 text-[#2A2A2A] hover:bg-[#F6F6F6] transition-colors"
        >
          <Download className="w-4 h-4" style={{ color: "#7BB27E" }} />
          Excel export
        </a>
        {selected.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
            {selected.size} törlése
          </button>
        )}
      </div>

      {/* Mobil kártya lista */}
      <div className="md:hidden space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-soft border border-border/50 space-y-2">
              <Skeleton className="h-4 w-3/4 rounded-lg" />
              <Skeleton className="h-3 w-1/2 rounded-lg" />
            </div>
          ))
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-sm text-muted-foreground shadow-soft border border-border/50">
            Nincs találat.
          </div>
        ) : (
          orders.map((o) => {
            const attachments = (o.attachments ?? []) as Attachment[];
            const zipFilename = buildZipFilename(o.source_sender, o.raw_email_subject, o.order_date);
            const isSelected = selected.has(o.id);
            const st = STATUS[o.status] ?? { color: "#999", bg: "#f5f5f5", label: o.status };
            return (
              <div
                key={o.id}
                className="bg-white rounded-2xl px-4 py-3 shadow-soft border border-border/50 flex items-center gap-3 cursor-pointer active:bg-[#F6F6F6] transition-colors"
                style={isSelected ? { background: "#F0F7F0" } : {}}
                onClick={() => router.push(`/orders/${o.id}`)}
              >
                <div onClick={(e) => { e.stopPropagation(); toggleSelect(o.id); }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(o.id)}
                    className="w-4 h-4 rounded accent-[#7BB27E] cursor-pointer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#2A2A2A] truncate">{extractEmail(o.source_sender)}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {o.order_date && (
                      <span className="text-xs text-muted-foreground">{new Date(o.order_date).toLocaleDateString("hu-HU")}</span>
                    )}
                    {o.total_amount && (
                      <span className="text-xs font-bold text-[#2A2A2A]">{o.total_amount.toLocaleString("hu-HU")} {o.currency ?? "HUF"}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                  {attachments.length > 0 && (
                    <a
                      href={`/api/orders/${o.id}/attachments`}
                      download={zipFilename}
                      className="p-1.5 rounded-lg text-[#E65100] bg-[#FFF3E0] hover:bg-[#FFE0B2] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={(e) => handleDeleteOne(e, o.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Asztali táblázat */}
      <div className="hidden md:block bg-white rounded-2xl shadow-soft border border-border/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40" style={{ background: "#F6F6F6" }}>
              <th className="pl-5 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded accent-[#7BB27E] cursor-pointer"
                />
              </th>
              {["Dátum", "Feladó", "Összeg", "Státusz", "Forrás", "Fájlok", ""].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-5 py-3.5">
                      <Skeleton className="h-4 w-full rounded-lg" />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-14 text-muted-foreground text-sm">
                  Nincs találat.
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const attachments = (o.attachments ?? []) as Attachment[];
                const zipFilename = buildZipFilename(o.source_sender, o.raw_email_subject, o.order_date);
                const isSelected = selected.has(o.id);
                return (
                  <tr
                    key={o.id}
                    className="cursor-pointer hover:bg-[#F6F6F6] transition-colors"
                    style={isSelected ? { background: "#F0F7F0" } : {}}
                    onClick={() => router.push(`/orders/${o.id}`)}
                  >
                    <td className="pl-5 py-3.5 w-8" onClick={(e) => { e.stopPropagation(); toggleSelect(o.id); }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(o.id)}
                        className="w-4 h-4 rounded accent-[#7BB27E] cursor-pointer"
                      />
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                      {o.order_date ? new Date(o.order_date).toLocaleDateString("hu-HU") : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#2A2A2A] max-w-[180px] truncate">
                      {extractEmail(o.source_sender)}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-[#2A2A2A] whitespace-nowrap">
                      {o.total_amount ? `${o.total_amount.toLocaleString("hu-HU")} ${o.currency ?? "HUF"}` : "—"}
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <InlineStatusSelect
                        orderId={o.id}
                        initialStatus={o.status}
                        onUpdated={(s) => updateOrderStatus(o.id, s)}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[140px] truncate">
                      {o.source_sender ?? "—"}
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      {attachments.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <a
                          href={`/api/orders/${o.id}/attachments`}
                          download={zipFilename}
                          title={zipFilename}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-[#FFB74D]/50 text-[#E65100] bg-[#FFF3E0] hover:bg-[#FFE0B2] transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="w-3 h-3" />
                          <span className="flex items-center gap-1">
                            {attachments.map((a, i) => (
                              <AttachmentIcon key={i} attachment={a} />
                            ))}
                          </span>
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDeleteOne(e, o.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Törlés"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Lapozó */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} rendelés összesen</span>
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 rounded-full bg-white border border-border/60 flex items-center justify-center disabled:opacity-40 hover:bg-[#F6F6F6]"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-[#2A2A2A]">{page} / {totalPages}</span>
            <button
              className="w-8 h-8 rounded-full bg-white border border-border/60 flex items-center justify-center disabled:opacity-40 hover:bg-[#F6F6F6]"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
