import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [{ error: ordersError }, { error: logsError }] = await Promise.all([
    supabaseAdmin.from("orders").delete().eq("user_id", userId),
    supabaseAdmin.from("sync_logs").delete().eq("user_id", userId),
  ]);

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }
  if (logsError) {
    return NextResponse.json({ error: logsError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
