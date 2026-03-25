"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createApplication,
  updateApplication,
  deleteApplication,
  addApplicationEvent,
} from "@/lib/data/applications";
import { CreateApplicationData, UpdateApplicationData } from "@/lib/types/database";

export async function createApplicationAction(data: CreateApplicationData) {
  const supabase = await createClient();
  try {
    const application = await createApplication(supabase, data);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/applications");
    return { success: true, data: application };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateApplicationAction(
  id: string,
  data: UpdateApplicationData
) {
  const supabase = await createClient();
  try {
    const application = await updateApplication(supabase, id, data);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/applications");
    return { success: true, data: application };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteApplicationAction(id: string) {
  const supabase = await createClient();
  try {
    await deleteApplication(supabase, id);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/applications");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function addNoteAction(
  applicationId: string,
  description: string
) {
  const supabase = await createClient();
  try {
    await addApplicationEvent(supabase, applicationId, {
      event_type: "note",
      description,
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/applications");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function scheduleFollowupAction(
  applicationId: string,
  date: string
) {
  const supabase = await createClient();
  try {
    await updateApplication(supabase, applicationId, {
      next_followup_at: date,
    });
    await addApplicationEvent(supabase, applicationId, {
      event_type: "followup_reminder",
      description: `Follow-up scheduled for ${new Date(date).toLocaleDateString()}`,
      metadata: { followup_date: date },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/applications");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
