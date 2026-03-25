import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncEmails } from "@/lib/gmail/sync";
import { classifyEmails } from "@/lib/gmail/classify";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const synced = await syncEmails(user.id);
    const classified = await classifyEmails(user.id);

    const { data: connection } = await supabase
      .from("gmail_connections")
      .select("last_synced_at")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({
      success: true,
      synced,
      classified,
      last_synced_at: connection?.last_synced_at ?? new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
