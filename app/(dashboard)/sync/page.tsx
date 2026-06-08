import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { SyncPanel } from "@/components/sync-panel";

export default async function SyncPage() {
  const session = await getServerSession(authOptions);

  const [{ data: logs }, { data: filterSettings }] = await Promise.all([
    supabaseAdmin
      .from("sync_logs")
      .select("*")
      .eq("user_id", session!.user.id)
      .order("started_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("user_filter_settings")
      .select("sync_from_date")
      .eq("user_id", session!.user.id)
      .single(),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gmail szinkronizáció</h1>
        <p className="text-sm text-slate-400 mt-1">
          Rendelés-emailek automatikus kinyerése a Gmail-fiókodból.
        </p>
      </div>
      <SyncPanel
        recentLogs={logs ?? []}
        syncFromDate={filterSettings?.sync_from_date ?? null}
      />
    </div>
  );
}
