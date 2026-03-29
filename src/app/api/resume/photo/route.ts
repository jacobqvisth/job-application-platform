import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BUCKET = "resume-photos";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await req.formData();
  const resumeId = formData.get("resumeId") as string | null;
  const photo = formData.get("photo") as File | null;

  if (!resumeId) {
    return NextResponse.json({ error: "resumeId is required" }, { status: 400 });
  }
  if (!photo) {
    return NextResponse.json({ error: "photo file is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(photo.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are accepted" },
      { status: 400 }
    );
  }
  if (photo.size > MAX_SIZE) {
    return NextResponse.json({ error: "Photo must be under 5MB" }, { status: 400 });
  }

  const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${resumeId}/photo.${ext}`;

  const arrayBuffer = await photo.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Ensure the bucket exists (public bucket for easy URL access)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: photo.type,
      upsert: true,
    });

  if (uploadError) {
    // If bucket doesn't exist, return a clear error
    if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("not found")) {
      return NextResponse.json(
        { error: "Storage bucket 'resume-photos' not found. Please create it in Supabase Storage." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { resumeId } = (await req.json()) as { resumeId?: string };
  if (!resumeId) {
    return NextResponse.json({ error: "resumeId is required" }, { status: 400 });
  }

  // Try to delete all common extensions
  const paths = ["jpg", "png", "webp"].map(
    (ext) => `${user.id}/${resumeId}/photo.${ext}`
  );

  await supabase.storage.from(BUCKET).remove(paths);

  return NextResponse.json({ success: true });
}
