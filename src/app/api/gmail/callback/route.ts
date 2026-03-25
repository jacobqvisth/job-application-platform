import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/gmail/auth";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?gmail_error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?gmail_error=missing_params`
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
        `${appUrl}/dashboard/settings?gmail_error=not_authenticated`
      );
    }

    // Verify the state token matches the session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || stateData.token !== session.access_token) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?gmail_error=invalid_state`
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get user's Gmail email address
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const gmailEmail = profile.data.emailAddress!;

    // Store connection in database
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    const { error: dbError } = await supabase
      .from("gmail_connections")
      .upsert(
        {
          user_id: user.id,
          email: gmailEmail,
          access_token: tokens.access_token!,
          refresh_token: tokens.refresh_token!,
          token_expires_at: expiresAt,
        },
        { onConflict: "user_id,email" }
      );

    if (dbError) {
      console.error("Error storing Gmail connection:", dbError);
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?gmail_error=db_error`
      );
    }

    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?gmail_connected=true`
    );
  } catch (err) {
    console.error("Gmail callback error:", err);
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?gmail_error=exchange_failed`
    );
  }
}
