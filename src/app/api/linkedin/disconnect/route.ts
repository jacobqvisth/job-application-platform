import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase
    .from("linkedin_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("Error disconnecting LinkedIn:", error);
    return NextResponse.json({ error: "Failed to disconnect LinkedIn" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
