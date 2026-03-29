import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserMarket } from "@/lib/data/markets";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Auto-create default market (Sweden) for new users
      if (data.user) {
        try {
          await ensureUserMarket(supabase, data.user.id);
        } catch {
          // Non-fatal — market can be set up later from settings
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
