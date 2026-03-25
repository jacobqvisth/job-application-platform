import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { syncEmails } from "@/lib/gmail/sync";
import { classifyEmails } from "@/lib/gmail/classify";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Use admin client to fetch all connections
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: connections, error } = await supabase
      .from("gmail_connections")
      .select("user_id");

    if (error) throw error;

    const results = [];

    for (const conn of connections ?? []) {
      try {
        const synced = await syncEmails(conn.user_id);
        const classified = await classifyEmails(conn.user_id);
        results.push({
          user_id: conn.user_id,
          synced,
          classified,
        });
      } catch (err) {
        console.error(`Sync failed for user ${conn.user_id}:`, err);
        results.push({
          user_id: conn.user_id,
          error: (err as Error).message,
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
