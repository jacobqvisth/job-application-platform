"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function approveJobLead(jobListingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("job_listings")
    .update({ lead_status: "approved", is_saved: true })
    .eq("id", jobListingId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  // Best-effort increment of approved count on job_email_sources
  try {
    const { data: listing } = await supabase
      .from("job_listings")
      .select("source_email_id")
      .eq("id", jobListingId)
      .single();

    if (listing?.source_email_id) {
      const { data: email } = await supabase
        .from("emails")
        .select("from_address")
        .eq("id", listing.source_email_id)
        .single();

      if (email) {
        const senderMatch = email.from_address.match(/<([^>]+)>/);
        const senderEmail = senderMatch
          ? senderMatch[1].toLowerCase()
          : email.from_address.toLowerCase().trim();

        const { data: source } = await supabase
          .from("job_email_sources")
          .select("id, total_approved")
          .eq("user_id", user.id)
          .eq("sender_email", senderEmail)
          .single();

        if (source) {
          await supabase
            .from("job_email_sources")
            .update({ total_approved: (source.total_approved || 0) + 1 })
            .eq("id", source.id);
        }
      }
    }
  } catch {
    // Non-critical — don't fail the action
  }

  revalidatePath("/dashboard/job-leads");
  return { success: true };
}

export async function rejectJobLead(jobListingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("job_listings")
    .update({ lead_status: "rejected" })
    .eq("id", jobListingId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  // Best-effort increment of rejected count
  try {
    const { data: listing } = await supabase
      .from("job_listings")
      .select("source_email_id")
      .eq("id", jobListingId)
      .single();

    if (listing?.source_email_id) {
      const { data: email } = await supabase
        .from("emails")
        .select("from_address")
        .eq("id", listing.source_email_id)
        .single();

      if (email) {
        const senderMatch = email.from_address.match(/<([^>]+)>/);
        const senderEmail = senderMatch
          ? senderMatch[1].toLowerCase()
          : email.from_address.toLowerCase().trim();

        const { data: source } = await supabase
          .from("job_email_sources")
          .select("id, total_rejected")
          .eq("user_id", user.id)
          .eq("sender_email", senderEmail)
          .single();

        if (source) {
          await supabase
            .from("job_email_sources")
            .update({ total_rejected: (source.total_rejected || 0) + 1 })
            .eq("id", source.id);
        }
      }
    }
  } catch {
    // Non-critical
  }

  revalidatePath("/dashboard/job-leads");
  return { success: true };
}

export async function undoRejectJobLead(jobListingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("job_listings")
    .update({ lead_status: "pending" })
    .eq("id", jobListingId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/job-leads");
  return { success: true };
}

export async function bulkApproveJobLeads(jobListingIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("job_listings")
    .update({ lead_status: "approved", is_saved: true })
    .in("id", jobListingIds)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/job-leads");
  return { success: true };
}

export async function bulkRejectJobLeads(jobListingIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("job_listings")
    .update({ lead_status: "rejected" })
    .in("id", jobListingIds)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/job-leads");
  return { success: true };
}

export async function toggleAutoExtract(sourceId: string, enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("job_email_sources")
    .update({ is_auto_extract: enabled, updated_at: new Date().toISOString() })
    .eq("id", sourceId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/job-leads");
  return { success: true };
}

export async function deleteJobEmailSource(sourceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("job_email_sources")
    .delete()
    .eq("id", sourceId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/job-leads");
  return { success: true };
}

export async function updateSourceDisplayName(
  sourceId: string,
  displayName: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = displayName.trim();
  if (!trimmed) return { error: "Display name cannot be empty" };
  if (trimmed.length > 100) return { error: "Display name must be 100 characters or less" };

  const { error } = await supabase
    .from("job_email_sources")
    .update({ display_name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", sourceId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/job-leads");
  return {};
}
