import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient } from '@/lib/supabase/server';
import {
  searchJobsTool,
  getApplicationStatusTool,
  prepareApplicationTool,
  getProfileSummaryTool,
  getWeeklyStatsTool,
  searchAnswerLibraryTool,
  showApplicationBoardTool,
  showResumePreviewTool,
  showInterviewPrepTool,
  navigateToTool,
  draftFollowUpEmailTool,
  practiceInterviewQuestionTool,
} from '@/lib/chat/tools';
import { buildSystemPrompt } from '@/lib/chat/system-prompt';
import { extractFlowContext } from '@/lib/chat/flow-context';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response('Unauthorized', { status: 401 });

  const { messages } = await req.json();

  // Fetch user context for system prompt
  const [profileRes, summaryRes, recentAppsRes] = await Promise.all([
    supabase.from('user_profile_data').select('*').eq('user_id', user.id).single(),
    supabase
      .from('knowledge_profile_summary')
      .select('executive_summary, key_strengths')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('applications')
      .select('id, company, role, status, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(10),
  ]);

  // Extract flow context from conversation history for system prompt injection
  const flowContext = extractFlowContext(messages ?? []);

  const systemPrompt = buildSystemPrompt(
    profileRes.data,
    summaryRes.data,
    recentAppsRes.data,
    flowContext
  );

  const tools = {
    searchJobs: searchJobsTool(user.id),
    getApplicationStatus: getApplicationStatusTool(user.id),
    prepareApplication: prepareApplicationTool(user.id),
    getProfileSummary: getProfileSummaryTool(user.id),
    getWeeklyStats: getWeeklyStatsTool(user.id),
    searchAnswerLibrary: searchAnswerLibraryTool(user.id),
    showApplicationBoard: showApplicationBoardTool(user.id),
    showResumePreview: showResumePreviewTool(user.id),
    showInterviewPrep: showInterviewPrepTool(user.id),
    navigateTo: navigateToTool(),
    draftFollowUpEmail: draftFollowUpEmailTool(user.id),
    practiceInterviewQuestion: practiceInterviewQuestionTool(user.id),
  };

  // Convert UIMessages to ModelMessages for streamText
  const modelMessages = await convertToModelMessages(messages, { tools });

  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: systemPrompt,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}
