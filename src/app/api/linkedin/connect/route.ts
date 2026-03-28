import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLinkedInAuthUrl } from "@/lib/linkedin/auth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const state = Buffer.from(
    JSON.stringify({ token: session.access_token })
  ).toString("base64");

  const authUrl = getLinkedInAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
