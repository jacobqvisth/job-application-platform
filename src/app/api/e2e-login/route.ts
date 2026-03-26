import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Test-only endpoint — requires E2E_SECRET to prevent unauthorized use
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, secret } = body;

  // Must provide the correct secret — reuses CRON_SECRET which is already on Vercel
  const expectedSecret = (process.env.E2E_SECRET || process.env.CRON_SECRET)?.trim();
  if (!expectedSecret || secret?.trim() !== expectedSecret) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return response;
}
