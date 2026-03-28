import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, getLinkedInProfile } from "@/lib/linkedin/auth";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?linkedin=error&reason=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?linkedin=error&reason=missing_params`
    );
  }

  try {
    // Verify state and get user
    const stateData = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?linkedin=error&reason=not_authenticated`
      );
    }

    // Verify the state token matches the session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || stateData.token !== session.access_token) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?linkedin=error&reason=invalid_state`
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get LinkedIn profile (name, email, id)
    const profile = await getLinkedInProfile(tokens.access_token);

    // Calculate token expiry (LinkedIn access tokens expire in 60 days by default)
    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    // Store connection in database (upsert by user_id — one per user)
    const { error: dbError } = await supabase
      .from("linkedin_connections")
      .upsert(
        {
          user_id: user.id,
          linkedin_id: profile.sub,
          email: profile.email ?? null,
          name: (profile.name || `${profile.given_name ?? ""} ${profile.family_name ?? ""}`.trim()) || null,
          profile_url: null,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          token_expires_at: expiresAt,
          scopes: ["openid", "profile", "email", "w_member_social"],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (dbError) {
      console.error("Error storing LinkedIn connection:", dbError);
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?linkedin=error&reason=db_error`
      );
    }

    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?linkedin=connected`
    );
  } catch (err) {
    console.error("LinkedIn callback error:", err);
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?linkedin=error&reason=exchange_failed`
    );
  }
}
