// ─── Client-side tracking (fire-and-forget) ──────────────────────────────────
// This file is safe to import in client components — no server-only imports.

export async function trackInteraction(data: {
  interactionType: 'suggestion_click' | 'chip_click' | 'morning_brief_action' | 'tool_invocation';
  actionText?: string;
  actionMessage?: string;
  toolName?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // Fire-and-forget — never block the UI for tracking
  fetch('/api/chat/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {}); // silently fail
}
