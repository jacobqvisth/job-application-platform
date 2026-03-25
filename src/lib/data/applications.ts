import { SupabaseClient } from "@supabase/supabase-js";
import {
  Application,
  ApplicationWithEvents,
  ApplicationStats,
  ApplicationStatus,
  CreateApplicationData,
  UpdateApplicationData,
  ApplicationEvent,
} from "@/lib/types/database";

export async function getApplications(
  supabase: SupabaseClient
): Promise<Application[]> {
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getApplication(
  supabase: SupabaseClient,
  id: string
): Promise<ApplicationWithEvents | null> {
  const { data, error } = await supabase
    .from("applications")
    .select("*, application_events(*)")
    .eq("id", id)
    .order("created_at", {
      referencedTable: "application_events",
      ascending: false,
    })
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function createApplication(
  supabase: SupabaseClient,
  data: CreateApplicationData
): Promise<Application> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const applicationData = {
    ...data,
    user_id: user.id,
    applied_at: data.status === "applied" ? new Date().toISOString() : null,
  };

  const { data: application, error } = await supabase
    .from("applications")
    .insert(applicationData)
    .select()
    .single();

  if (error) throw error;

  // Create initial status event
  await supabase.from("application_events").insert({
    application_id: application.id,
    event_type: "status_change",
    description: `Application created with status: ${data.status || "saved"}`,
    metadata: { new_status: data.status || "saved" },
  });

  return application;
}

export async function updateApplication(
  supabase: SupabaseClient,
  id: string,
  data: UpdateApplicationData
): Promise<Application> {
  // Get current application to check for status change
  const { data: current } = await supabase
    .from("applications")
    .select("status")
    .eq("id", id)
    .single();

  const updateData = { ...data };
  // Set applied_at when transitioning to applied
  if (data.status === "applied" && current?.status !== "applied") {
    updateData.applied_at = new Date().toISOString();
  }

  const { data: application, error } = await supabase
    .from("applications")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // Create status change event if status changed
  if (data.status && current && data.status !== current.status) {
    await supabase.from("application_events").insert({
      application_id: id,
      event_type: "status_change",
      description: `Status changed from ${current.status} to ${data.status}`,
      metadata: {
        old_status: current.status,
        new_status: data.status,
      },
    });
  }

  return application;
}

export async function deleteApplication(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("applications").delete().eq("id", id);
  if (error) throw error;
}

export async function addApplicationEvent(
  supabase: SupabaseClient,
  applicationId: string,
  event: {
    event_type: ApplicationEvent["event_type"];
    description?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<ApplicationEvent> {
  const { data, error } = await supabase
    .from("application_events")
    .insert({
      application_id: applicationId,
      ...event,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getApplicationStats(
  supabase: SupabaseClient
): Promise<ApplicationStats> {
  const { data: applications, error } = await supabase
    .from("applications")
    .select("status, created_at, applied_at");

  if (error) throw error;

  const apps = applications ?? [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const byStatus: Record<ApplicationStatus, number> = {
    saved: 0,
    applied: 0,
    screening: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
    withdrawn: 0,
  };

  let thisWeek = 0;
  let appliedCount = 0;
  let respondedCount = 0;

  for (const app of apps) {
    const status = app.status as ApplicationStatus;
    byStatus[status] = (byStatus[status] || 0) + 1;

    if (new Date(app.created_at) >= weekAgo) {
      thisWeek++;
    }

    // Count response rate: apps that got past "applied" status
    if (app.applied_at || status !== "saved") {
      appliedCount++;
      if (
        status !== "applied" &&
        status !== "saved"
      ) {
        respondedCount++;
      }
    }
  }

  return {
    total: apps.length,
    thisWeek,
    byStatus,
    responseRate:
      appliedCount > 0
        ? Math.round((respondedCount / appliedCount) * 100)
        : null,
  };
}

export async function getRecentEvents(
  supabase: SupabaseClient,
  limit = 10
): Promise<(ApplicationEvent & { applications: Pick<Application, "company" | "role"> })[]> {
  const { data, error } = await supabase
    .from("application_events")
    .select("*, applications(company, role)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
