import { createClient } from '@/lib/supabase/server';

export interface InsightApplication {
  id: string;
  company: string;
  role: string;
  status: string;
  updated_at: string;
  applied_at: string | null;
}

export interface InsightInteraction {
  interaction_type: string;
  action_text: string | null;
  tool_name: string | null;
  created_at: string;
}

export interface InsightsData {
  applications: InsightApplication[];
  interactions: InsightInteraction[];
}

export async function fetchInsightsData(userId: string): Promise<InsightsData> {
  const supabase = await createClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [appsRes, interactionsRes] = await Promise.all([
    supabase
      .from('applications')
      .select('id, company, role, status, updated_at, applied_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('chat_interactions')
      .select('interaction_type, action_text, tool_name, created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false }),
  ]);

  return {
    applications: appsRes.data ?? [],
    interactions: interactionsRes.data ?? [],
  };
}
