// Simple event emitter for cross-component communication.
// Used to notify the context sidebar when a chat tool executes.

type ChatEventHandler = () => void;
const listeners = new Set<ChatEventHandler>();

export function onChatToolExecuted(handler: ChatEventHandler) {
  listeners.add(handler);
  return () => { listeners.delete(handler); };
}

export function emitChatToolExecuted() {
  listeners.forEach((handler) => handler());
}
