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
  getSearchInsightsTool,
  shareOnLinkedInTool,
  saveJobSearchTool,
  saveJobToTrackerTool,
  importJobScreenshotTool,
  getDiscoveredJobsTool,
  startApplicationTool,
} from '@/lib/chat/tools';
import { buildSystemPrompt } from '@/lib/chat/system-prompt';
import { extractFlowContext } from '@/lib/chat/flow-context';
import { detectJobSearchStage } from '@/lib/chat/stage-detection';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response('Unauthorized', { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawBody = await req.json() as any;
  const messages: import('ai').UIMessage[] = rawBody.messages ?? [];
  const conversationId: string | undefined = rawBody.conversationId;

  // Extract latest image attachment for importJobScreenshot tool
  const rawLatestMsg = (rawBody.messages ?? [])[rawBody.messages?.length - 1];
  const latestImageAttachment = ((rawLatestMsg?.experimental_attachments ?? []) as Array<{ url?: string; contentType?: string; name?: string }>).find(
    (a) => a.contentType?.startsWith("image/")
  );

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
      .select('id, company, role, status, updated_at, applied_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50),
  ]);

  // Detect job search stage from application data (no extra DB query — uses recentAppsRes)
  const allApps = recentAppsRes.data ?? [];
  const stageContext = detectJobSearchStage(allApps);

  // Extract flow context from conversation history for system prompt injection
  const flowContext = extractFlowContext(messages ?? []);

  const systemPrompt = buildSystemPrompt(
    profileRes.data,
    summaryRes.data,
    allApps.slice(0, 10),
    flowContext,
    stageContext
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
    getSearchInsights: getSearchInsightsTool(user.id),
    shareOnLinkedIn: shareOnLinkedInTool(user.id),
    saveJobSearch: saveJobSearchTool(user.id),
    saveJobToTracker: saveJobToTrackerTool(user.id),
    importJobScreenshot: importJobScreenshotTool(user.id, latestImageAttachment),
    getDiscoveredJobs: getDiscoveredJobsTool(user.id),
    startApplication: startApplicationTool(user.id),
  };

  // Convert UIMessages to ModelMessages for streamText
  const modelMessages = await convertToModelMessages(messages, { tools });

  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: systemPrompt,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(8),
    onFinish: async ({ toolResults }) => {
      // Track tool invocations server-side (fire-and-forget)
      if (toolResults && toolResults.length > 0) {
        try {
          const rows = toolResults.map((t) => ({
            user_id: user.id,
            conversation_id: conversationId ?? null,
            interaction_type: 'tool_invocation',
            tool_name: t.toolName,
            metadata: {},
          }));
          // Non-blocking insert (fire and forget)
          void supabase.from('chat_interactions').insert(rows);
        } catch {
          // Silently fail — tracking is non-critical
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
