"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "new",  label: "Új" },
  { value: "done", label: "Feldolgozott" },
];

interface Props { orderId: string; currentStatus: string }

export function OrderStatusSelect({ orderId, currentStatus }: Props) {
  const [status, setStatus] = useState(currentStatus);
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
      toast.success("Státusz frissítve");
    } else {
      toast.error("Hiba a mentés során");
    }
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Státusz:</span>
      <Select value={status} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger className="w-44 rounded-xl bg-white border-border/60 focus:ring-[#7BB27E]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
