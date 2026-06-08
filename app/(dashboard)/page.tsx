import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DashboardViews } from "@/components/dashboard-views";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const firstName = session!.user.name?.split(" ")[0] ?? "ott";

  const [{ data: orders }, { data: lastSync }] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select(
        "id, source_sender, raw_email_subject, raw_email_body, email_type, attachments, order_number, order_date, total_amount, currency, status, customer_name, customer_email"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("sync_logs")
      .select("finished_at, orders_found")
      .eq("user_id", userId)
      .eq("status", "done")
      .order("finished_at", { ascending: false })
      .limit(1),
  ]);

  const nowStr = new Date().toLocaleDateString("hu-HU", {
    weekday: "short", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-7">
      {/* Fejléc */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#2A2A2A]">
            Üdvözöljük, <span style={{ color: "#7BB27E" }}>{firstName}!</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{nowStr}</p>
          {lastSync?.[0] && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Utolsó szinkronizáció:{" "}
              {new Date(lastSync[0].finished_at!).toLocaleString("hu-HU")}
              {" · "}
              <span style={{ color: "#7BB27E" }} className="font-semibold">
                {orders?.length ?? 0} levél összesen
              </span>
            </p>
          )}
        </div>
        <Link
          href="/sync"
          className="flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-full transition-all hover:opacity-90 shadow-sm"
          style={{ background: "#7BB27E" }}
        >
          <RefreshCw className="w-4 h-4" />
          Szinkronizálás
        </Link>
      </div>

      {/* Bemutató sáv */}
      <div className="bg-white rounded-2xl shadow-soft border border-border/50 px-6 py-4 flex items-start gap-4">
        <div className="text-3xl select-none">📦</div>
        <div>
          <p className="text-sm font-semibold text-[#2A2A2A]">Mi ez az alkalmazás?</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            A Gmail-fiókodat összekapcsolva automatikusan kiszűri az online rendeléseidhez
            tartozó leveleket — összegek, dátumok és feladók szerint rendezve. A rendelésekhez
            csatolt számlákat és dokumentumokat egyetlen kattintással le is töltheted ZIP-fájlba.
          </p>
        </div>
      </div>

      {/* Dashboard nézetek */}
      {!orders || orders.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft border border-border/50 py-16 text-center">
          <p className="text-muted-foreground text-sm">Még nincsenek szinkronizált levelek.</p>
          <Link href="/sync" className="text-sm font-semibold mt-1 inline-block" style={{ color: "#7BB27E" }}>
            Szinkronizálj most →
          </Link>
        </div>
      ) : (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <DashboardViews orders={orders as any} />
      )}
    </div>
  );
}
