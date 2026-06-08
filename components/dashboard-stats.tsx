"use client";

import { ShoppingBag, TrendingUp, Clock, AlertCircle } from "lucide-react";

interface Stats {
  total: number;
  today: number;
  revenue: number;
  manual: number;
}

const cards = [
  {
    key: "total" as const,
    title: "Összes rendelés",
    icon: ShoppingBag,
    bg: "#E8F5E9",
    iconColor: "#7BB27E",
    textColor: "#2A6E3A",
  },
  {
    key: "today" as const,
    title: "Mai rendelések",
    icon: Clock,
    bg: "#FCE4EC",
    iconColor: "#E57373",
    textColor: "#B71C1C",
  },
  {
    key: "revenue" as const,
    title: "Bevétel (HUF)",
    icon: TrendingUp,
    bg: "#EDE7F6",
    iconColor: "#9575CD",
    textColor: "#4527A0",
    format: (v: number) => v.toLocaleString("hu-HU"),
  },
  {
    key: "manual" as const,
    title: "Manuális",
    icon: AlertCircle,
    bg: "#FFF3E0",
    iconColor: "#FFB74D",
    textColor: "#E65100",
  },
];

export function DashboardStats({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const raw = stats[c.key] as number;
        const display = c.format ? c.format(raw) : raw;
        return (
          <div
            key={c.key}
            className="rounded-2xl p-5 flex flex-col gap-3 shadow-soft border border-white/80"
            style={{ background: c.bg }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.textColor, opacity: 0.7 }}>
                {c.title}
              </p>
              <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center">
                <c.icon className="w-4 h-4" style={{ color: c.iconColor }} />
              </div>
            </div>
            <p className="text-3xl font-bold" style={{ color: c.textColor }}>
              {display}
            </p>
          </div>
        );
      })}
    </div>
  );
}
