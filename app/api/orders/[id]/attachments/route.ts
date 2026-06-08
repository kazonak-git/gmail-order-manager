import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getGmailClient } from "@/lib/gmail";
import JSZip from "jszip";
import type { Attachment } from "@/types/database";
import { buildZipFilename } from "@/lib/zip-filename";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("gmail_message_id, attachments, source_sender, raw_email_subject, order_date")
    .eq("id", params.id)
    .eq("user_id", session.user.id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const attachments = (order.attachments ?? []) as Attachment[];
  if (attachments.length === 0) {
    return NextResponse.json({ error: "No attachments" }, { status: 404 });
  }

  const gmail = getGmailClient(session.accessToken as string);
  const messageId = order.gmail_message_id as string;

  let files: { filename: string; data: Buffer }[];
  try {
    files = await Promise.all(
      attachments.map(async (att) => {
        const res = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId,
          id: att.attachmentId,
        });
        // Gmail API returns base64url-encoded data
        const base64 = (res.data.data ?? "").replace(/-/g, "+").replace(/_/g, "/");
        return { filename: att.filename, data: Buffer.from(base64, "base64") };
      })
    );
  } catch (err) {
    console.error("[ATTACHMENTS] Gmail API error:", err);
    return NextResponse.json({ error: "Failed to fetch attachments from Gmail" }, { status: 502 });
  }

  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.filename, file.data);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const zipFilename = buildZipFilename(
    order.source_sender as string | null,
    order.raw_email_subject as string | null,
    order.order_date as string | null,
  );

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFilename}"`,
      "Content-Length": zipBuffer.length.toString(),
    },
  });
}
