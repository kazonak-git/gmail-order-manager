"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, XCircle, Clock, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import type { SyncLog } from "@/types/database";

function defaultFromDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}


interface Props {
  recentLogs: SyncLog[];
  syncFromDate: string | null; // mentett dátum Supabase-ből, vagy null
}

export function SyncPanel({ recentLogs, syncFromDate }: Props) {
  const [fromDate, setFromDate] = useState<string>(syncFromDate ?? defaultFromDate());
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<{ emails_scanned: number; orders_found: number } | null>(null);
  async function handleSync() {
    setSyncing(true);
    setLastResult(null);
    try {
      // 1. Dátum mentése Supabase-be
      await fetch("/api/settings/filters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_from_date: fromDate }),
      });

      // 2. Szinkronizáció indítása
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncFromDate: fromDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLastResult(data);
      toast.success(`Kész! ${data.orders_found} új rendelés mentve.`);
      window.location.href = "/";
    } catch (err: unknown) {
      toast.error(`Hiba: ${err instanceof Error ? err.message : "Ismeretlen hiba"}`);
    } finally {
      setSyncing(false);
    }
  }

  const statusIcon = {
    running: <Clock className="w-4 h-4" style={{ color: "#4FC3F7" }} />,
    done:    <CheckCircle className="w-4 h-4" style={{ color: "#7BB27E" }} />,
    error:   <XCircle className="w-4 h-4" style={{ color: "#E57373" }} />,
  };

  return (
    <div className="space-y-5">
      {/* Infó */}
      <div className="bg-white rounded-2xl shadow-soft border border-border/50 px-6 py-4">
        <p className="text-sm text-muted-foreground">
          A szűrési beállításokat (kulcsszavak, feladók) a{" "}
          <a href="/settings" className="font-semibold hover:underline" style={{ color: "#7BB27E" }}>
            Beállítások
          </a>{" "}
          menüpontban módosíthatod.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-border/50 p-6 space-y-5">
        <h2 className="font-bold text-[#2A2A2A] text-base">Szinkronizáció indítása</h2>

        {/* Dátumválasztó */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
            Szűrés kezdete
          </label>
          <div className="flex items-center gap-3">
            <div className="relative">
              <CalendarDays
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: "#7BB27E" }}
              />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="pl-9 pr-3 py-2 bg-[#F6F6F6] border border-border/60 rounded-xl text-sm text-[#2A2A2A] focus:outline-none focus:ring-2 focus:ring-[#7BB27E]/40"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Ettől a dátumtól keresi a leveleket (
              <code className="bg-[#F6F6F6] px-1 rounded">{fromDate.replace(/-/g, "/")}</code>
              )
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            A beállított dátumot automatikusan menti a rendszer a következő szinkronizációhoz.
          </p>
        </div>

        {/* Indítás gomb */}
        <button
          onClick={handleSync}
          disabled={syncing || !fromDate}
          className="flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-60 shadow-sm"
          style={{ background: "#7BB27E" }}
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Szinkronizálás folyamatban..." : "Szinkronizáció indítása"}
        </button>

        {lastResult && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "#E8F5E9", color: "#2A6E3A" }}>
            ✓ {lastResult.emails_scanned} email átvizsgálva · {lastResult.orders_found} új rendelés mentve
          </div>
        )}
      </div>

      {/* Előzmények */}
      {recentLogs.length > 0 && (
        <div className="bg-white rounded-2xl shadow-soft border border-border/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40">
            <h2 className="font-bold text-[#2A2A2A] text-base">Szinkronizáció előzmények</h2>
          </div>
          <div className="divide-y divide-border/30">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-6 py-3.5">
                <div className="flex items-center gap-3">
                  {statusIcon[log.status]}
                  <div>
                    <p className="text-sm font-semibold text-[#2A2A2A]">
                      {new Date(log.started_at).toLocaleString("hu-HU")}
                    </p>
                    {log.error_message && (
                      <p className="text-xs" style={{ color: "#E57373" }}>{log.error_message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{log.emails_scanned} email</span>
                  <span
                    className="font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "#E8F5E9", color: "#7BB27E" }}
                  >
                    {log.orders_found} rendelés
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
