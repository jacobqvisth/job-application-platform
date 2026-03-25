"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { linkEmailToApplication, markEmailAsRead } from "@/lib/data/emails";

export async function linkEmailAction(emailId: string, applicationId: string) {
  const supabase = await createClient();
  try {
    await linkEmailToApplication(supabase, emailId, applicationId);
    revalidatePath("/dashboard/emails");
    revalidatePath("/dashboard/applications");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function markEmailReadAction(emailId: string) {
  const supabase = await createClient();
  try {
    await markEmailAsRead(supabase, emailId);
    revalidatePath("/dashboard/emails");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function disconnectGmailAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  try {
    const { error } = await supabase
      .from("gmail_connections")
      .delete()
      .eq("user_id", user.id);

    if (error) throw error;
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
