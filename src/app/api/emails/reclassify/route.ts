import { createClient } from "@/lib/supabase/server";
import type { EmailClassification } from "@/lib/types/database";

const VALID_CLASSIFICATIONS: EmailClassification[] = [
  "rejection",
  "interview_invite",
  "followup",
  "offer",
  "general",
  "job_alert",
  "unclassified",
];

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { emailId?: string; classification?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { emailId, classification } = body;
  if (!emailId || !classification) {
    return Response.json(
      { error: "emailId and classification are required" },
      { status: 400 }
    );
  }

  if (!VALID_CLASSIFICATIONS.includes(classification as EmailClassification)) {
    return Response.json({ error: "Invalid classification" }, { status: 400 });
  }

  // Verify email belongs to user
  const { data: email, error: fetchError } = await supabase
    .from("emails")
    .select("id, user_id")
    .eq("id", emailId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !email) {
    return Response.json({ error: "Email not found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("emails")
    .update({ classification })
    .eq("id", emailId);

  if (updateError) {
    return Response.json(
      { error: "Failed to update classification" },
      { status: 500 }
    );
  }

  return Response.json({ success: true, classification });
}
