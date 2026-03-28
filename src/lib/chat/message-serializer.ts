import type { UIMessage } from "ai";

/**
 * Serialize a UIMessage for database storage.
 * All tool outputs are plain data objects — safe to JSON round-trip.
 * Only reconstruct Date objects on deserialize.
 */
export function serializeMessage(message: UIMessage): Record<string, unknown> {
  return JSON.parse(JSON.stringify(message)) as Record<string, unknown>;
}

/**
 * Deserialize a stored message back into UIMessage format.
 * Reconstructs createdAt as a Date instance.
 */
export function deserializeMessage(stored: Record<string, unknown>): UIMessage {
  const msg = {
    ...stored,
    createdAt: stored.createdAt ? new Date(stored.createdAt as string) : new Date(),
  };
  return msg as unknown as UIMessage;
}

/**
 * Extract plain text from a UIMessage for the content column / list previews.
 */
export function extractPlainText(message: UIMessage): string {
  const msg = message as unknown as { parts?: Array<{ type: string; text?: string }> };
  const parts = msg.parts ?? [];
  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join(" ")
    .slice(0, 500);
}
