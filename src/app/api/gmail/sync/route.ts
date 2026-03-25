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

    return NextResponse.json({
      success: true,
      synced,
      classified,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
