"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, ShoppingBag, RefreshCw, LogOut, Settings2 } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Rendeléshez tartozó levelek", icon: ShoppingBag },
  { href: "/sync", label: "Szinkronizáció", icon: RefreshCw },
  { href: "/settings", label: "Beállítások", icon: Settings2 },
];

interface SidebarProps {
  user: { name?: string | null; email?: string | null; image?: string | null };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const initials = user.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  return (
    <aside className="hidden md:flex w-60 bg-white border-r border-border/60 flex-col py-6 px-4 shrink-0 shadow-[1px_0_12px_rgba(0,0,0,0.04)]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-8">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "#7BB27E" }}>
          <ShoppingBag className="w-4.5 h-4.5 text-white" size={18} />
        </div>
        <div>
          <p className="font-bold text-[#2A2A2A] text-sm leading-tight">Order</p>
          <p className="font-bold text-[#7BB27E] text-sm leading-tight">Manager</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-2">Menü</p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "text-white shadow-sm"
                  : "text-[#2A2A2A]/70 hover:bg-[#F6F6F6] hover:text-[#2A2A2A]"
              )}
              style={active ? { background: "#7BB27E" } : {}}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-border/60 pt-4 mt-4">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: "#7BB27E" }}>
            {user.image
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={user.image} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
              : initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#2A2A2A] truncate">{user.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Kijelentkezés
        </button>
      </div>
    </aside>
  );
}
