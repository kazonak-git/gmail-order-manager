"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingBag, RefreshCw, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/",        label: "Dashboard",    icon: LayoutDashboard },
  { href: "/orders",  label: "Rendelések",   icon: ShoppingBag },
  { href: "/sync",    label: "Szinkron",     icon: RefreshCw },
  { href: "/settings",label: "Beállítások",  icon: Settings2 },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border/60 flex items-stretch shadow-[0_-2px_12px_rgba(0,0,0,0.06)] pb-safe md:hidden">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold transition-colors",
              active ? "text-[#7BB27E]" : "text-muted-foreground"
            )}
          >
            <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
