import type { SearchJobsResult, ApplicationPackageData } from './types';

export interface FlowContext {
  lastSearchResults?: {
    query: string;
    jobCount: number;
    topCompanies: string[];
  };
  lastApplicationPackage?: {
    company: string;
    role: string;
  };
  activeFlow?: 'discovery' | 'interview_prep' | 'weekly_review' | 'email_followup';
  recentToolCalls: string[]; // Last 5 tool names called, newest first
}

/**
 * Extract flow context from the conversation message history.
 * Works with both UIMessage (client) and the raw JSON messages from the API request.
 * Used server-side for system prompt injection and client-side for chip rendering.
 */
export function extractFlowContext(messages: unknown[]): FlowContext {
  const recentToolCalls: string[] = [];
  let lastSearchResults: FlowContext['lastSearchResults'];
  let lastApplicationPackage: FlowContext['lastApplicationPackage'];

  // Walk backwards (newest first) through messages to find recent tool calls
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as { role?: string; parts?: unknown[] };
    if (msg.role !== 'assistant' || !Array.isArray(msg.parts)) continue;

    for (let j = msg.parts.length - 1; j >= 0; j--) {
      const part = msg.parts[j] as Record<string, unknown>;
      const type = part.type as string | undefined;
      if (!type) continue;

      let toolName: string | null = null;
      if (type === 'dynamic-tool') {
        toolName = part.toolName as string;
      } else if (type.startsWith('tool-')) {
        toolName = type.replace(/^tool-/, '');
      }

      if (!toolName) continue;

      // Keep up to 5 unique tool names (newest first)
      if (recentToolCalls.length < 5 && !recentToolCalls.includes(toolName)) {
        recentToolCalls.push(toolName);
      }

      const output = part.output as Record<string, unknown> | null | undefined;
      if (!output) continue;

      // Extract last search results
      if (toolName === 'searchJobs' && !lastSearchResults) {
        const result = output as unknown as SearchJobsResult;
        lastSearchResults = {
          query: result.query ?? '',
          jobCount: result.total ?? 0,
          topCompanies: (result.jobs ?? []).slice(0, 3).map((j) => j.company),
        };
      }

      // Extract last application package
      if (toolName === 'prepareApplication' && !lastApplicationPackage) {
        const result = output as unknown as ApplicationPackageData;
        lastApplicationPackage = {
          company: result.company ?? '',
          role: result.role ?? '',
        };
      }
    }
  }

  // Determine active flow from recent tool sequence
  let activeFlow: FlowContext['activeFlow'];
  if (recentToolCalls.some((t) => ['searchJobs', 'prepareApplication'].includes(t))) {
    activeFlow = 'discovery';
  } else if (
    recentToolCalls.some((t) => ['showInterviewPrep', 'practiceInterviewQuestion'].includes(t))
  ) {
    activeFlow = 'interview_prep';
  } else if (recentToolCalls.includes('getWeeklyStats')) {
    activeFlow = 'weekly_review';
  } else if (recentToolCalls.includes('draftFollowUpEmail')) {
    activeFlow = 'email_followup';
  }

  return { recentToolCalls, lastSearchResults, lastApplicationPackage, activeFlow };
}

/**
 * Build a human-readable summary of the flow context for injection into the system prompt.
 */
export function buildFlowContextSection(ctx: FlowContext): string {
  if (ctx.recentToolCalls.length === 0) return '';

  const lines: string[] = [];

  if (ctx.recentToolCalls.length > 0) {
    lines.push(`- Recent tools used: ${ctx.recentToolCalls.join(' → ')}`);
  }
  if (ctx.activeFlow) {
    const flowLabels: Record<string, string> = {
      discovery: 'Discovery → Apply',
      interview_prep: 'Interview Prep',
      weekly_review: 'Weekly Review',
      email_followup: 'Email Follow-Up',
    };
    lines.push(`- Active flow: ${flowLabels[ctx.activeFlow] ?? ctx.activeFlow}`);
  }
  if (ctx.lastSearchResults) {
    const { query, jobCount, topCompanies } = ctx.lastSearchResults;
    lines.push(
      `- Last search: "${query}" (${jobCount} jobs found${topCompanies.length > 0 ? `, top companies: ${topCompanies.join(', ')}` : ''})`
    );
  }
  if (ctx.lastApplicationPackage) {
    lines.push(
      `- Last application prepared: ${ctx.lastApplicationPackage.role} at ${ctx.lastApplicationPackage.company}`
    );
  }

  if (lines.length === 0) return '';
  return `\n## Recent Conversation Context\n${lines.join('\n')}`;
}
