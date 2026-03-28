"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ChatMessage } from "@/components/chat/chat-message";
import { QuickActionChips } from "@/components/chat/quick-action-chips";
import { WelcomeCard } from "@/components/chat/welcome-card";
import { useVoiceInput } from "@/hooks/use-voice-input";

type LastTool =
  | "searchJobs"
  | "getApplicationStatus"
  | "prepareApplication"
  | "getProfileSummary"
  | "getWeeklyStats"
  | "searchAnswerLibrary"
  | null;

const KNOWN_TOOLS: LastTool[] = [
  "searchJobs",
  "getApplicationStatus",
  "prepareApplication",
  "getProfileSummary",
  "getWeeklyStats",
  "searchAnswerLibrary",
];

function getLastTool(messages: ReturnType<typeof useChat>["messages"]): LastTool {
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

export default function ChatPage() {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [welcomeData, setWelcomeData] = useState<{
    name?: string | null;
    activeApplications: number;
    newJobMatches: number;
    movedForwardThisWeek: number;
  } | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: () => {
      toast.error("Something went wrong. Please try again.");
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  const { isListening, transcript, startListening, stopListening } = useVoiceInput();
  const voiceSupported =
    typeof window !== "undefined" &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  // Populate input from voice transcript
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Load welcome data on mount
  useEffect(() => {
    fetchWelcomeData().then((d) => {
      setWelcomeData(
        d ?? { activeApplications: 0, newJobMatches: 0, movedForwardThisWeek: 0 }
      );
    });
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;
      setInput("");
      sendMessage({ text });
    },
    [isLoading, sendMessage]
  );

  const handleQuickAction = useCallback(
    (message: string) => {
      handleSend(message);
    },
    [handleSend]
  );

  const handleAppend = useCallback(
    (content: string) => {
      handleSend(content);
    },
    [handleSend]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const lastTool = getLastTool(messages);
  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-2px)] max-h-full -m-4 md:-m-6">
      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        {isEmpty && welcomeData !== null ? (
          <WelcomeCard data={welcomeData} onSelect={handleQuickAction} />
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} onAppend={handleAppend} />
          ))
        )}

        {/* Typing indicator when AI is processing but no assistant message yet */}
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
          onSelect={handleQuickAction}
          disabled={isLoading}
        />

        <div className="px-4 md:px-6 pb-4 flex items-end gap-2">
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
