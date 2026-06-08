"use client";

import { useState } from "react";
import { X, Plus, RotateCcw, Save, Trash2, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { DEFAULT_KEYWORDS, DEFAULT_SENDERS } from "@/lib/gmail-query";

interface Props {
  initialKeywords: string[];
  initialSenders: string[];
}

export function SettingsPanel({ initialKeywords, initialSenders }: Props) {
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [senders, setSenders] = useState<string[]>(initialSenders);
  const [newKeyword, setNewKeyword] = useState("");
  const [newSender, setNewSender] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function addKeyword() {
    const val = newKeyword.trim().toLowerCase();
    if (!val || keywords.includes(val)) return;
    setKeywords((prev) => [...prev, val]);
    setNewKeyword("");
  }

  function addSender() {
    const val = newSender.trim().toLowerCase();
    if (!val || senders.includes(val)) return;
    setSenders((prev) => [...prev, val]);
    setNewSender("");
  }

  function removeKeyword(kw: string) {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }

  function removeSender(s: string) {
    setSenders((prev) => prev.filter((x) => x !== s));
  }

  function resetToDefaults() {
    setKeywords([...DEFAULT_KEYWORDS]);
    setSenders([...DEFAULT_SENDERS]);
    toast.info("Visszaállítva az alapértelmezett értékekre — ne felejtsd el menteni.");
  }

  async function handleDeleteAll() {
    const confirmed = window.confirm(
      "Biztosan törölsz minden mentett rendelést? Ez nem visszavonható."
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/data/reset", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Minden levél törölve a listából.");
      window.location.href = "/";
    } catch (err: unknown) {
      toast.error(`Hiba: ${err instanceof Error ? err.message : "Ismeretlen hiba"}`);
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/filters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, senders }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Beállítások elmentve!");
    } catch (err: unknown) {
      toast.error(`Hiba: ${err instanceof Error ? err.message : "Ismeretlen hiba"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Kulcsszavak */}
      <div className="bg-white rounded-2xl shadow-soft border border-border/50 p-6 space-y-4">
        <div>
          <h2 className="font-bold text-[#2A2A2A] text-base">Kulcsszavak</h2>
          <p className="text-xs text-muted-foreground mt-1">
            A Gmail szűrés a levél{" "}
            <span className="font-semibold text-[#2A2A2A]">tárgyában</span> keresi
            ezeket a szavakat (<code className="bg-[#F6F6F6] px-1 rounded">subject:(...))</code>
            ). Az app-oldali szűrés a levél törzsében is ellenőrzi.
          </p>
        </div>

        {/* Tag lista */}
        <div className="flex flex-wrap gap-2">
          {keywords.map((kw) => (
            <span
              key={kw}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{ background: "#E8F5E9", color: "#2A6E3A" }}
            >
              {kw}
              <button
                onClick={() => removeKeyword(kw)}
                className="ml-0.5 rounded-full hover:bg-black/10 transition-colors p-0.5"
                aria-label={`${kw} törlése`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {keywords.length === 0 && (
            <span className="text-sm text-muted-foreground italic">
              Nincs kulcsszó — adj hozzá legalább egyet
            </span>
          )}
        </div>

        {/* Hozzáadás */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addKeyword()}
            placeholder="Új kulcsszó (pl. rendelés)"
            className="flex-1 bg-[#F6F6F6] border border-border/60 rounded-xl px-3 py-2 text-sm text-[#2A2A2A] focus:outline-none focus:ring-2 focus:ring-[#7BB27E]/40"
          />
          <button
            onClick={addKeyword}
            disabled={!newKeyword.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40"
            style={{ background: "#F6F6F6", borderColor: "#7BB27E", color: "#7BB27E" }}
          >
            <Plus className="w-4 h-4" />
            Hozzáad
          </button>
        </div>
      </div>

      {/* Feladók */}
      <div className="bg-white rounded-2xl shadow-soft border border-border/50 p-6 space-y-4">
        <div>
          <h2 className="font-bold text-[#2A2A2A] text-base">Feladók</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Megadhatsz cégnevet (pl. <code className="bg-[#F6F6F6] px-1 rounded">decathlon</code>)
            vagy teljes email-tartományt (pl.{" "}
            <code className="bg-[#F6F6F6] px-1 rounded">noreply@shop.hu</code>). A Gmail{" "}
            <code className="bg-[#F6F6F6] px-1 rounded">from:(...)</code> szűrőbe kerülnek.
          </p>
        </div>

        {/* Tag lista */}
        <div className="flex flex-wrap gap-2">
          {senders.map((s) => (
            <span
              key={s}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{ background: "#EDE7F6", color: "#5E35B1" }}
            >
              {s}
              <button
                onClick={() => removeSender(s)}
                className="ml-0.5 rounded-full hover:bg-black/10 transition-colors p-0.5"
                aria-label={`${s} törlése`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {senders.length === 0 && (
            <span className="text-sm text-muted-foreground italic">
              Nincs feladó — adj hozzá legalább egyet
            </span>
          )}
        </div>

        {/* Hozzáadás */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newSender}
            onChange={(e) => setNewSender(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSender()}
            placeholder="Feladó (pl. amazon, noreply@shop.hu)"
            className="flex-1 bg-[#F6F6F6] border border-border/60 rounded-xl px-3 py-2 text-sm text-[#2A2A2A] focus:outline-none focus:ring-2 focus:ring-[#7BB27E]/40"
          />
          <button
            onClick={addSender}
            disabled={!newSender.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40"
            style={{ background: "#F6F6F6", borderColor: "#9575CD", color: "#9575CD" }}
          >
            <Plus className="w-4 h-4" />
            Hozzáad
          </button>
        </div>
      </div>

      {/* Akciók */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-60 shadow-sm"
          style={{ background: "#7BB27E" }}
        >
          <Save className="w-4 h-4" />
          {saving ? "Mentés..." : "Beállítások mentése"}
        </button>

        <button
          onClick={resetToDefaults}
          className="flex items-center gap-2 px-4 py-3 rounded-full text-sm font-semibold transition-all hover:bg-[#F6F6F6]"
          style={{ color: "#888" }}
        >
          <RotateCcw className="w-4 h-4" />
          Visszaállítás alapértelmezettre
        </button>
      </div>
      {/* Fiók — kijelentkezés (mobilon is elérhető) */}
      <div className="bg-white rounded-2xl shadow-soft border border-border/50 p-6 space-y-4 md:hidden">
        <h2 className="font-bold text-[#2A2A2A] text-base">Fiók</h2>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          style={{ color: "#888", borderColor: "#E0E0E0" }}
        >
          <LogOut className="w-4 h-4" />
          Kijelentkezés
        </button>
      </div>

      {/* Veszélyes műveletek */}
      <div className="bg-white rounded-2xl border-2 p-6 space-y-4" style={{ borderColor: "#FFCDD2" }}>
        <div>
          <h2 className="font-bold text-base" style={{ color: "#C62828" }}>
            Adatok törlése
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Ezek a műveletek <span className="font-semibold" style={{ color: "#C62828" }}>nem visszavonhatók</span>.
            Törlés után az adatok véglegesen elvesznek.
          </p>
        </div>

        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: "#FFF5F5" }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "#2A2A2A" }}>
              Összes rendelés törlése
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Minden mentett rendelés és szinkronizációs előzmény törlődik.
            </p>
          </div>
          <button
            onClick={handleDeleteAll}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:opacity-90 disabled:opacity-50 shrink-0 ml-4"
            style={{ background: "#E53935", color: "#fff", borderColor: "#E53935" }}
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Törlés..." : "Összes levél törlése a listából"}
          </button>
        </div>
      </div>
    </div>
  );
}
