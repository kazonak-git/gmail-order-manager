import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_KEYWORDS, DEFAULT_SENDERS } from "@/lib/gmail-query";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("user_filter_settings")
    .select("*")
    .eq("user_id", session.user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found — nem hiba, csak még nincs beállítás
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    // Még nincs mentett beállítás → visszaadjuk az alapértelmezett értékeket
    return NextResponse.json({
      keywords: DEFAULT_KEYWORDS,
      senders: DEFAULT_SENDERS,
      sync_from_date: null,
      isDefault: true,
    });
  }

  return NextResponse.json({
    keywords: data.keywords,
    senders: data.senders,
    sync_from_date: data.sync_from_date ?? null,
    isDefault: false,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  // keywords és senders opcionálisak — ha nem jönnek, nem írjuk felül
  const upsertData: Record<string, unknown> = {
    user_id: session.user.id,
    updated_at: new Date().toISOString(),
  };

  if (Array.isArray(body.keywords)) {
    upsertData.keywords = body.keywords.map((k: unknown) => String(k).trim()).filter(Boolean);
  }
  if (Array.isArray(body.senders)) {
    upsertData.senders = body.senders.map((s: unknown) => String(s).trim()).filter(Boolean);
  }
  if (typeof body.sync_from_date === "string" || body.sync_from_date === null) {
    upsertData.sync_from_date = body.sync_from_date;
  }

  const { error } = await supabaseAdmin
    .from("user_filter_settings")
    .upsert(upsertData, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
