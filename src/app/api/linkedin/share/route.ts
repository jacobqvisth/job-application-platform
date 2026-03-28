import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidLinkedInToken } from "@/lib/linkedin/auth";
import type { LinkedInConnection } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let text: string;
  let visibility: string = "PUBLIC";

  try {
    const body = await request.json();
    text = body.text;
    if (body.visibility) visibility = body.visibility;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Post text is required" }, { status: 400 });
  }

  if (text.length > 3000) {
    return NextResponse.json({ error: "Post text exceeds LinkedIn's 3000 character limit" }, { status: 400 });
  }

  // Fetch LinkedIn connection
  const { data: connection, error: connError } = await supabase
    .from("linkedin_connections")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (connError || !connection) {
    return NextResponse.json(
      { error: "LinkedIn not connected. Please connect your account in Settings." },
      { status: 401 }
    );
  }

  try {
    const accessToken = await getValidLinkedInToken(connection as LinkedInConnection);

    const postBody = {
      author: `urn:li:person:${connection.linkedin_id}`,
      lifecycleState: "PUBLISHED",
      visibility: visibility === "PUBLIC" ? "PUBLIC" : "CONNECTIONS",
      commentary: text.trim(),
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
    };

    const response = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "LinkedIn-Version": "202401",
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LinkedIn share API error:", response.status, errorText);

      if (response.status === 401) {
        return NextResponse.json(
          { error: "LinkedIn authorization expired. Please reconnect your account in Settings." },
          { status: 401 }
        );
      }
      if (response.status === 429) {
        return NextResponse.json(
          { error: "LinkedIn rate limit reached. Please try again later." },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Failed to post to LinkedIn. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("LinkedIn share error:", err);
    if (err instanceof Error && err.message.includes("expired")) {
      return NextResponse.json(
        { error: "LinkedIn token expired. Please reconnect in Settings." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Failed to share to LinkedIn. Please try again." },
      { status: 500 }
    );
  }
}
