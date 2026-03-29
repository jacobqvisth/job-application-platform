import { createClient } from "@/lib/supabase/server";
import type { LinkedInConnection } from "@/lib/types/database";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

const SCOPES = ["openid", "profile", "email", "w_member_social"];

const LINKEDIN_CLIENT_ID = (process.env.LINKEDIN_CLIENT_ID ?? "").trim();
const LINKEDIN_CLIENT_SECRET = (process.env.LINKEDIN_CLIENT_SECRET ?? "").trim();

export function getLinkedInAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/linkedin/callback`,
    state,
    scope: SCOPES.join(" "),
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/linkedin/callback`,
    client_id: LINKEDIN_CLIENT_ID,
    client_secret: LINKEDIN_CLIENT_SECRET,
  });

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn token exchange failed: ${error}`);
  }

  return response.json() as Promise<TokenResponse>;
}

export async function refreshLinkedInToken(refreshToken: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: LINKEDIN_CLIENT_ID,
    client_secret: LINKEDIN_CLIENT_SECRET,
  });

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn token refresh failed: ${error}`);
  }

  return response.json() as Promise<TokenResponse>;
}

export interface LinkedInUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
}

export async function getLinkedInProfile(accessToken: string): Promise<LinkedInUserInfo> {
  const response = await fetch(LINKEDIN_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch LinkedIn profile");
  }

  return response.json() as Promise<LinkedInUserInfo>;
}

/**
 * Returns a valid access token for the given connection, refreshing if needed.
 * Updates the DB if the token was refreshed.
 */
export async function getValidLinkedInToken(connection: LinkedInConnection): Promise<string> {
  const expiresAt = new Date(connection.token_expires_at);
  // Give 5-minute buffer before expiry
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return connection.access_token;
  }

  if (!connection.refresh_token) {
    throw new Error("LinkedIn token expired and no refresh token available. Please reconnect.");
  }

  const newTokens = await refreshLinkedInToken(connection.refresh_token);
  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

  // Update tokens in database
  const supabase = await createClient();
  await supabase
    .from("linkedin_connections")
    .update({
      access_token: newTokens.access_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return newTokens.access_token;
}
