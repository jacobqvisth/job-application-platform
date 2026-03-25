import { SupabaseClient } from "@supabase/supabase-js";
import type {
  Email,
  EmailWithApplication,
  EmailClassification,
  GmailConnection,
} from "@/lib/types/database";

export async function getEmails(
  supabase: SupabaseClient,
  filters?: {
    classification?: EmailClassification;
    applicationId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<EmailWithApplication[]> {
  let query = supabase
    .from("emails")
    .select("*, applications(id, company, role, status)")
    .order("received_at", { ascending: false });

  if (filters?.classification) {
    query = query.eq("classification", filters.classification);
  }
  if (filters?.applicationId) {
    query = query.eq("application_id", filters.applicationId);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getEmailById(
  supabase: SupabaseClient,
  emailId: string
): Promise<EmailWithApplication | null> {
  const { data, error } = await supabase
    .from("emails")
    .select("*, applications(id, company, role, status)")
    .eq("id", emailId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function getEmailsForApplication(
  supabase: SupabaseClient,
  applicationId: string
): Promise<Email[]> {
  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .eq("application_id", applicationId)
    .order("received_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getGmailConnection(
  supabase: SupabaseClient,
  userId: string
): Promise<GmailConnection | null> {
  const { data, error } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function linkEmailToApplication(
  supabase: SupabaseClient,
  emailId: string,
  applicationId: string
): Promise<void> {
  const { error } = await supabase
    .from("emails")
    .update({ application_id: applicationId })
    .eq("id", emailId);

  if (error) throw error;
}

export async function markEmailAsRead(
  supabase: SupabaseClient,
  emailId: string
): Promise<void> {
  const { error } = await supabase
    .from("emails")
    .update({ is_read: true })
    .eq("id", emailId);

  if (error) throw error;
}

export async function getEmailStats(
  supabase: SupabaseClient
): Promise<{
  unread: number;
  byClassification: Record<string, number>;
}> {
  const { data: emails, error } = await supabase
    .from("emails")
    .select("is_read, classification");

  if (error) throw error;

  const items = emails ?? [];
  let unread = 0;
  const byClassification: Record<string, number> = {};

  for (const email of items) {
    if (!email.is_read) unread++;
    const cls = email.classification ?? "unclassified";
    byClassification[cls] = (byClassification[cls] || 0) + 1;
  }

  return { unread, byClassification };
}
