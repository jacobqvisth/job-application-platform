"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mic, MicOff, Send, Loader2, ArrowLeft, MoreVertical, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ChatMessage } from "@/components/chat/chat-message";
import { QuickActionChips } from "@/components/chat/quick-action-chips";
import { WelcomeCard } from "@/components/chat/welcome-card";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { emitChatToolExecuted } from "@/lib/chat/chat-events";
import { extractFlowContext } from "@/lib/chat/flow-context";
import type { UIMessage } from "ai";
import type { ConversationSummary } from "@/components/chat/conversation-list";

type LastTool =
  | "searchJobs"
  | "getApplicationStatus"
  | "prepareApplication"
  | "getProfileSummary"
  | "getWeeklyStats"
  | "searchAnswerLibrary"
  | "showApplicationBoard"
  | "showResumePreview"
  | "showInterviewPrep"
  | "navigateTo"
  | "draftFollowUpEmail"
  | "practiceInterviewQuestion"
  | null;

const KNOWN_TOOLS: LastTool[] = [
  "searchJobs",
  "getApplicationStatus",
  "prepareApplication",
  "getProfileSummary",
  "getWeeklyStats",
  "searchAnswerLibrary",
  "showApplicationBoard",
  "showResumePreview",
  "showInterviewPrep",
  "navigateTo",
  "draftFollowUpEmail",
  "practiceInterviewQuestion",
];

function getLastTool(messages: UIMessage[]): LastTool {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    for (let j = msg.parts.length - 1; j >= 0; j--) {
      const part = msg.parts[j];
      const type = part.type;
      let toolName: string | null = null;
      if (type === "dynamic-tool") {
        toolName = (part as { toolName: string }).toolName;
      } else if (type.startsWith("tool-")) {
        toolName = type.replace(/^tool-/, "");
      }
      if (toolName && KNOWN_TOOLS.includes(toolName as LastTool)) {
        return toolName as LastTool;
      }
    }
  }
  return null;
}

async function fetchWelcomeData() {
  try {
    const res = await fetch("/api/chat/welcome");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchConversations(): Promise<ConversationSummary[]> {
  try {
    const res = await fetch("/api/chat/conversations");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ─── Inner component: manages the actual chat for one conversation ────────────

interface ChatInterfaceProps {
  conversationId: string | null;
  initialMessages: UIMessage[];
  askMessage: string | null;
  welcomeData: {
    name?: string | null;
    activeApplications: number;
    newJobMatches: number;
    movedForwardThisWeek: number;
  } | null;
  conversations: ConversationSummary[];
  onConversationCreated: (id: string) => void;
  onConversationTitleUpdated: (id: string, title: string) => void;
  onConversationDeleted: (id: string) => void;
  onBack: () => void;
  onQuickSelectConversation: (message: string) => void;
}

function ChatInterface({
  conversationId: initialConversationId,
  initialMessages,
  askMessage,
  welcomeData,
  conversations,
  onConversationCreated,
  onConversationTitleUpdated,
  onConversationDeleted,
  onBack,
  onQuickSelectConversation,
}: ChatInterfaceProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  // Track the active conversation ID (created lazily on first send)
  const conversationIdRef = useRef<string | null>(initialConversationId);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);

  // Find current conversation metadata from list
  const currentConv = conversations.find((c) => c.id === conversationId) ?? null;

  // Track which message IDs are already persisted in the DB
  const persistedIdsRef = useRef(new Set(initialMessages.map((m) => m.id)));

  // Track if the ?ask= param was auto-sent
  const askedRef = useRef(false);
  const prevStatusRef = useRef<string>("ready");

  const saveMessagesToDb = useCallback(
    async (convId: string, msgs: UIMessage[]) => {
      const unsaved = msgs.filter((m) => !persistedIdsRef.current.has(m.id));
      if (unsaved.length === 0) return;
      try {
        const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: unsaved }),
        });
        if (!res.ok) throw new Error("Save failed");
        const data = (await res.json()) as { saved: number; title?: string };
        unsaved.forEach((m) => persistedIdsRef.current.add(m.id));
        if (data.title) onConversationTitleUpdated(convId, data.title);
      } catch {
        // Retry once after 3s
        setTimeout(async () => {
          if (!conversationIdRef.current) return;
          const retry = msgs.filter((m) => !persistedIdsRef.current.has(m.id));
          if (retry.length === 0) return;
          try {
            const res = await fetch(`/api/chat/conversations/${conversationIdRef.current}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messages: retry }),
            });
            if (!res.ok) return;
            const data = (await res.json()) as { saved: number; title?: string };
            retry.forEach((m) => persistedIdsRef.current.add(m.id));
            if (data.title && conversationIdRef.current) {
              onConversationTitleUpdated(conversationIdRef.current, data.title);
            }
          } catch {
            toast.error("Couldn't save conversation — messages may be lost on refresh.");
          }
        }, 3000);
      }
    },
    [onConversationTitleUpdated]
  );

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: initialMessages,
    onError: () => {
      toast.error("Something went wrong. Please try again.");
    },
    onFinish: ({ messages: allMessages }) => {
      if (!conversationIdRef.current) return;
      saveMessagesToDb(conversationIdRef.current, allMessages);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  const { isListening, transcript, startListening, stopListening } = useVoiceInput();
  const voiceSupported =
    typeof window !== "undefined" &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  // Populate input from voice transcript
  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Emit chat tool executed event on response completion
  useEffect(() => {
    if (prevStatusRef.current !== "ready" && status === "ready" && messages.length > 0) {
      emitChatToolExecuted();
    }
    prevStatusRef.current = status;
  }, [status, messages.length]);

  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New conversation" }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      const conv = (await res.json()) as ConversationSummary;
      conversationIdRef.current = conv.id;
      setConversationId(conv.id);
      window.history.replaceState({}, "", `/dashboard/chat?c=${conv.id}`);
      onConversationCreated(conv.id);
      return conv.id;
    } catch {
      toast.error("Couldn't create conversation. Your message will still be sent.");
      return null;
    }
  }, [onConversationCreated]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      setInput("");
      await ensureConversation();
      sendMessage({ text });
    },
    [isLoading, sendMessage, ensureConversation]
  );

  // Auto-send ?ask= message
  useEffect(() => {
    if (askedRef.current || !askMessage) return;
    askedRef.current = true;
    setTimeout(() => handleSend(askMessage), 50);
  }, [askMessage, handleSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  // Keyboard shortcut: Cmd/Ctrl+Shift+O → new conversation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "o") {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onBack]);

  // Title editing
  const handleTitleEdit = () => {
    setTitleInput(currentConv?.title ?? "New conversation");
    setEditingTitle(true);
  };
  const handleTitleSave = async () => {
    setEditingTitle(false);
    const trimmed = titleInput.trim();
    if (!trimmed || !conversationId) return;
    try {
      await fetch(`/api/chat/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      onConversationTitleUpdated(conversationId, trimmed);
    } catch {
      toast.error("Couldn't update title.");
    }
  };

  const handleDelete = async () => {
    if (!conversationId) return onBack();
    try {
      await fetch(`/api/chat/conversations/${conversationId}`, { method: "DELETE" });
      onConversationDeleted(conversationId);
      onBack();
    } catch {
      toast.error("Couldn't delete conversation.");
    }
  };

  const lastTool = getLastTool(messages);
  const flowContext = extractFlowContext(messages);
  const isEmpty = messages.length === 0;
  const hasConversation = !!conversationId;

  return (
    <div className="flex flex-col h-full -m-4 md:-m-6">
      {/* Conversation header — only shown when a conversation is active */}
      {hasConversation && (
        <div className="flex items-center gap-2 px-4 md:px-6 h-10 border-b bg-background shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={onBack}
            title="Back to conversations (⌘⇧O)"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>

          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input
                autoFocus
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSave();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="w-full text-sm font-medium bg-transparent border-none outline-none px-1 rounded focus:ring-1 focus:ring-ring"
              />
            ) : (
              <button
                onClick={handleTitleEdit}
                className="text-sm font-medium truncate max-w-full text-left hover:text-primary transition-colors flex items-center gap-1 group"
                title="Click to rename"
              >
                <span className="truncate">
                  {currentConv?.title ?? "New conversation"}
                </span>
                <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 shrink-0" />
              </button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleTitleEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        {isEmpty && welcomeData !== null ? (
          <WelcomeCard
            data={welcomeData}
            conversations={conversations}
            onSelect={onQuickSelectConversation}
            onSelectConversation={(id) => {
              window.location.href = `/dashboard/chat?c=${id}`;
            }}
          />
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onAppend={(content) => handleSend(content)}
            />
          ))
        )}

        {/* Typing indicator */}
        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[oklch(0.44_0.19_265)] to-[oklch(0.62_0.16_240)] flex items-center justify-center">
              <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
            </div>
            <div className="flex items-center gap-1 px-4 py-2.5 bg-muted rounded-2xl rounded-tl-sm">
              <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick action chips + input */}
      <div className="border-t bg-background pt-2">
        <QuickActionChips
          lastTool={lastTool}
          flowContext={flowContext}
          onSelect={(msg) => handleSend(msg)}
          disabled={isLoading}
        />

        <div className="px-4 md:px-6 pb-4 pb-safe flex items-end gap-2">
          <div className="flex-1">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to work on?"
              className="resize-none min-h-10 max-h-40 py-2.5 text-sm leading-relaxed"
              rows={1}
              disabled={isLoading}
            />
          </div>

          {/* New conversation button */}
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="shrink-0"
            onClick={onBack}
            title="New conversation (⌘⇧O)"
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* Voice input */}
          {voiceSupported && (
            <Button
              type="button"
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              className={`shrink-0 ${isListening ? "animate-pulse" : ""}`}
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}

          {/* Send */}
          <Button
            type="button"
            size="icon"
            className="shrink-0"
            disabled={!input.trim() || isLoading}
            onClick={() => handleSend(input)}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Outer page: handles URL routing + conversation list ──────────────────────

export default function ChatPage() {
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();

  const [welcomeData, setWelcomeData] = useState<{
    name?: string | null;
    activeApplications: number;
    newJobMatches: number;
    movedForwardThisWeek: number;
  } | null>(null);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  // Active conversation state: null = welcome screen
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  // The ask= param message — sent once on mount
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const askHandledRef = useRef(false);

  useEffect(() => setMounted(true), []);

  // Load welcome data and conversations list on mount
  useEffect(() => {
    fetchWelcomeData().then((d) => {
      setWelcomeData(
        d ?? { activeApplications: 0, newJobMatches: 0, movedForwardThisWeek: 0 }
      );
    });
    fetchConversations().then(setConversations);
  }, []);

  // Handle URL params on mount
  useEffect(() => {
    if (!mounted) return;

    const cParam = searchParams.get("c");
    const askParam = searchParams.get("ask");

    if (cParam) {
      // Load existing conversation
      loadConversation(cParam);
    } else if (askParam && !askHandledRef.current) {
      // ?ask= with no conversation → will create lazily on first send
      askHandledRef.current = true;
      setPendingAsk(askParam);
      window.history.replaceState({}, "", "/dashboard/chat");
      // Show empty chat interface (no conversation yet, ask will be auto-sent)
      setActiveConversationId(null);
      setInitialMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  async function loadConversation(id: string) {
    setIsLoadingConversation(true);
    try {
      const res = await fetch(`/api/chat/conversations/${id}`);
      if (!res.ok) {
        // Conversation not found or unauthorized — go to welcome
        window.history.replaceState({}, "", "/dashboard/chat");
        setActiveConversationId(null);
        setInitialMessages([]);
        return;
      }
      const data = (await res.json()) as {
        conversation: ConversationSummary;
        messages: UIMessage[];
      };
      // Merge conversation into list if not already there
      setConversations((prev) => {
        if (prev.find((c) => c.id === id)) return prev;
        return [data.conversation, ...prev];
      });
      setInitialMessages(data.messages);
      setActiveConversationId(id);
    } catch {
      toast.error("Couldn't load conversation.");
      setActiveConversationId(null);
      setInitialMessages([]);
    } finally {
      setIsLoadingConversation(false);
    }
  }

  const handleSelectConversation = useCallback(async (id: string) => {
    window.history.pushState({}, "", `/dashboard/chat?c=${id}`);
    await loadConversation(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = useCallback(() => {
    window.history.pushState({}, "", "/dashboard/chat");
    setActiveConversationId(null);
    setInitialMessages([]);
    setPendingAsk(null);
    // Refresh conversations list
    fetchConversations().then(setConversations);
  }, []);

  const handleNewConversation = useCallback(() => {
    setPendingAsk(null);
    handleBack();
  }, [handleBack]);

  const handleConversationCreated = useCallback((id: string) => {
    // Will be reflected in list after save completes
    window.history.replaceState({}, "", `/dashboard/chat?c=${id}`);
    setActiveConversationId(id);
  }, []);

  const handleConversationTitleUpdated = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }, []);

  const handleConversationDeleted = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleQuickSelectConversation = useCallback(
    (id: string) => {
      handleSelectConversation(id);
    },
    [handleSelectConversation]
  );

  if (!mounted) return <div className="flex-1" />;

  if (isLoadingConversation) {
    return (
      <div className="flex flex-col h-full -m-4 md:-m-6 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show chat interface when we have an active conversation OR a pending ask
  const showChatInterface = activeConversationId !== null || pendingAsk !== null;

  if (showChatInterface) {
    return (
      <ChatInterface
        key={activeConversationId ?? "new"}
        conversationId={activeConversationId}
        initialMessages={initialMessages}
        askMessage={pendingAsk}
        welcomeData={welcomeData}
        conversations={conversations}
        onConversationCreated={handleConversationCreated}
        onConversationTitleUpdated={handleConversationTitleUpdated}
        onConversationDeleted={handleConversationDeleted}
        onBack={handleBack}
        onQuickSelectConversation={handleQuickSelectConversation}
      />
    );
  }

  // No active conversation — show welcome screen
  return (
    <ChatInterface
      key="welcome"
      conversationId={null}
      initialMessages={[]}
      askMessage={null}
      welcomeData={welcomeData}
      conversations={conversations}
      onConversationCreated={handleConversationCreated}
      onConversationTitleUpdated={handleConversationTitleUpdated}
      onConversationDeleted={handleConversationDeleted}
      onBack={handleNewConversation}
      onQuickSelectConversation={handleQuickSelectConversation}
    />
  );
}
