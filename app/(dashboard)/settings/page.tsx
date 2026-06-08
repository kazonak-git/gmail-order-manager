import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_KEYWORDS, DEFAULT_SENDERS } from "@/lib/gmail-query";
import { SettingsPanel } from "@/components/settings-panel";

export const metadata = { title: "Beállítások" };

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { data } = await supabaseAdmin
    .from("user_filter_settings")
    .select("keywords, senders")
    .eq("user_id", session.user.id)
    .single();

  const keywords: string[] = data?.keywords ?? DEFAULT_KEYWORDS;
  const senders: string[] = data?.senders ?? DEFAULT_SENDERS;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2A2A2A]">Beállítások</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gmail szűrő kulcsszavak és feladók kezelése. A mentett lista alapján épül
          fel a szinkronizáció lekérdezése.
        </p>
      </div>

      <SettingsPanel initialKeywords={keywords} initialSenders={senders} />
    </div>
  );
}
