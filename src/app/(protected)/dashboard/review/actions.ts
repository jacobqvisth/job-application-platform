"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedUserId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not authenticated");
  return data.user.id;
}

export async function markApplicationRejectedAction(
  applicationId: string
): Promise<void> {
  await getAuthenticatedUserId();
  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("applications")
    .select("status")
    .eq("id", applicationId)
    .single();

  if (fetchError || !current) throw new Error("Application not found");

  const { error: updateError } = await supabase
    .from("applications")
    .update({ status: "rejected" })
    .eq("id", applicationId);

  if (updateError) throw updateError;

  await supabase.from("application_events").insert({
    application_id: applicationId,
    event_type: "status_change",
    description: "Marked as rejected from weekly review",
    metadata: {
      old_status: current.status,
      new_status: "rejected",
    },
  });

  revalidatePath("/dashboard/review");
  revalidatePath("/dashboard/pipeline");
}
