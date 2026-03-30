import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processScreenshotImport } from "@/lib/jobs/screenshot-import";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { imageBase64, mimeType } = body;

  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
  }

  const validMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
  type ValidMime = (typeof validMimeTypes)[number];
  const resolvedMime: ValidMime = validMimeTypes.includes(mimeType as ValidMime)
    ? (mimeType as ValidMime)
    : "image/png";

  try {
    const result = await processScreenshotImport(
      supabase,
      user.id,
      imageBase64,
      resolvedMime
    );

    if (result.errorMessage) {
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Screenshot import failed:", err);
    return NextResponse.json(
      { error: "Failed to process screenshot. Please try again." },
      { status: 500 }
    );
  }
}
