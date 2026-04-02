"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { markJobListingAsApplied } from "@/lib/jobs/dedup";
import type { ApplicationStatus } from "@/lib/types/database";
import type { PipelineStatus } from "@/lib/data/pipeline";


/**
 * Composite action: move a pipeline item to a new status.
 * Handles all transitions: lead→saved/rejected, saved→applied+, app→any status.
 */
export async function movePipelineItem(
  jobListingId: string | null,
  applicationId: string | null,
  currentStatus: PipelineStatus,
  newStatus: PipelineStatus
): Promise<{ success: boolean; error?: string; applicationId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // ── Lead → Saved: approve the lead ──────────────────────────────────────
  if (currentStatus === "lead" && newStatus === "saved") {
    const { error } = await supabase
      .from("job_listings")
      .update({ lead_status: "approved", is_saved: true })
      .eq("id", jobListingId!)
      .eq("user_id", user.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/pipeline");
    return { success: true };
  }

  // ── Lead → Rejected: reject the lead ────────────────────────────────────
  if (currentStatus === "lead" && newStatus === "rejected") {
    const { error } = await supabase
      .from("job_listings")
      .update({ lead_status: "rejected" })
      .eq("id", jobListingId!)
      .eq("user_id", user.id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/pipeline");
    return { success: true };
  }

  // ── Has application: update status directly ──────────────────────────────
  if (applicationId) {
    const updateData: { status: ApplicationStatus; applied_at?: string | null } = {
      status: newStatus as ApplicationStatus,
    };
    if (newStatus === "applied") {
      // Get current status to set applied_at if transitioning in
      const { data: current } = await supabase
        .from("applications")
        .select("status, applied_at")
        .eq("id", applicationId)
        .single();
      if (current?.status !== "applied" && !current?.applied_at) {
        updateData.applied_at = new Date().toISOString();
      }
    }

    const { error } = await supabase
      .from("applications")
      .update(updateData)
      .eq("id", applicationId)
      .eq("user_id", user.id);
    if (error) return { success: false, error: error.message };

    // Log status change event
    await supabase.from("application_events").insert({
      application_id: applicationId,
      event_type: "status_change",
      description: `Status changed from ${currentStatus} to ${newStatus}`,
      metadata: { old_status: currentStatus, new_status: newStatus },
    });

    revalidatePath("/dashboard/pipeline");
    return { success: true, applicationId };
  }

  // ── Saved (no app) → Application status: create application ─────────────
  if (jobListingId && newStatus !== "lead" && newStatus !== "saved") {
    const { data: listing } = await supabase
      .from("job_listings")
      .select("company, title, url, description, source")
      .eq("id", jobListingId)
      .eq("user_id", user.id)
      .single();

    if (!listing) return { success: false, error: "Job listing not found" };

    const { data: newApp, error: appError } = await supabase
      .from("applications")
      .insert({
        user_id: user.id,
        company: listing.company,
        role: listing.title,
        url: listing.url,
        status: newStatus as ApplicationStatus,
        applied_at: newStatus === "applied" ? new Date().toISOString() : null,
        job_description: listing.description ?? null,
        job_listing_id: jobListingId,
      })
      .select("id")
      .single();

    if (appError || !newApp) {
      return { success: false, error: appError?.message ?? "Failed to create application" };
    }

    await markJobListingAsApplied(supabase, jobListingId, newApp.id);

    // Log initial event
    await supabase.from("application_events").insert({
      application_id: newApp.id,
      event_type: "status_change",
      description: `Application created with status: ${newStatus}`,
      metadata: { new_status: newStatus },
    });

    revalidatePath("/dashboard/pipeline");
    return { success: true, applicationId: newApp.id };
  }

  return { success: false, error: "No valid transition for given state" };
}

/**
 * Bulk move multiple pipeline items to a new status.
 */
export async function bulkMovePipelineItems(
  items: { jobListingId: string | null; applicationId: string | null; currentStatus: PipelineStatus }[],
  newStatus: PipelineStatus
): Promise<{ success: boolean; error?: string }> {
  const results = await Promise.allSettled(
    items.map((item) =>
      movePipelineItem(item.jobListingId, item.applicationId, item.currentStatus, newStatus)
    )
  );

  const failed = results.filter(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success)
  );

  if (failed.length > 0) {
    return { success: false, error: `${failed.length} item(s) failed to update` };
  }

  revalidatePath("/dashboard/pipeline");
  return { success: true };
}

/**
 * Delete a pipeline item — removes the application and/or job listing.
 */
export async function deletePipelineItem(
  jobListingId: string | null,
  applicationId: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  if (applicationId) {
    const { error } = await supabase
      .from("applications")
      .delete()
      .eq("id", applicationId)
      .eq("user_id", user.id);
    if (error) return { success: false, error: error.message };
  }

  if (jobListingId) {
    const { error } = await supabase
      .from("job_listings")
      .delete()
      .eq("id", jobListingId)
      .eq("user_id", user.id);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/pipeline");
  return { success: true };
}
