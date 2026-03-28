"use client";

import { Loader2, User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";
import { isTextUIPart } from "ai";
import { JobSearchResults } from "./job-search-results";
import { ApplicationStatusCards } from "./application-status-cards";
import { ApplicationPackage } from "./application-package";
import { ProfileSummaryCard } from "./profile-summary-card";
import { WeeklyStatsCard } from "./weekly-stats-card";
import { AnswerLibraryResults } from "./answer-library-results";
import type {
  SearchJobsResult,
  ApplicationStatusResult,
  ApplicationPackageData,
  ProfileSummaryData,
  WeeklyStatsResult,
  SearchAnswerLibraryResult,
} from "@/lib/chat/types";

const TOOL_LOADING_LABELS: Record<string, string> = {
  searchJobs: "Searching for jobs...",
  getApplicationStatus: "Loading your applications...",
  prepareApplication: "Preparing your application package...",
  getProfileSummary: "Loading your profile...",
  getWeeklyStats: "Calculating your stats...",
  searchAnswerLibrary: "Searching answer library...",
};

interface ChatMessageProps {
  message: UIMessage;
  onAppend?: (content: string) => void;
}

function ToolResult({
  toolName,
  result,
  onAppend,
}: {
  toolName: string;
  result: unknown;
  onAppend?: (content: string) => void;
}) {
  if (!result) return null;

  const r = result as Record<string, unknown>;

  if (r.error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {String(r.message ?? "An error occurred.")}
      </div>
    );
  }

  switch (toolName) {
    case "searchJobs":
      return <JobSearchResults data={result as SearchJobsResult} onAppend={onAppend} />;
    case "getApplicationStatus":
      return <ApplicationStatusCards data={result as ApplicationStatusResult} onAppend={onAppend} />;
    case "prepareApplication":
      return <ApplicationPackage data={result as ApplicationPackageData} onAppend={onAppend} />;
    case "getProfileSummary":
      return <ProfileSummaryCard data={result as ProfileSummaryData} />;
    case "getWeeklyStats":
      return <WeeklyStatsCard data={result as WeeklyStatsResult} />;
    case "searchAnswerLibrary":
      return <AnswerLibraryResults data={result as SearchAnswerLibraryResult} />;
    default:
      return null;
  }
}

export function ChatMessage({ message, onAppend }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Extract text from parts
  const textParts = message.parts.filter(isTextUIPart);
  const textContent = textParts.map((p) => p.text).join("").trim();

  // Extract tool parts (both static 'tool-*' and dynamic 'dynamic-tool')
  const toolParts = message.parts.filter(
    (p): p is typeof p & { type: string; toolCallId: string; state: string; toolName?: string; output?: unknown } =>
      p.type === "dynamic-tool" || p.type.startsWith("tool-")
  );

  if (!textContent && toolParts.length === 0) return null;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-[oklch(0.44_0.19_265)] to-[oklch(0.62_0.16_240)] text-white"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-2 min-w-0 flex-1 ${isUser ? "items-end" : "items-start"}`}>
        {/* Text content */}
        {textContent && (
          <div
            className={`rounded-2xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed ${
              isUser
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-muted rounded-tl-sm"
            }`}
          >
            {isUser ? (
              <span className="whitespace-pre-wrap">{textContent}</span>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2">
                <ReactMarkdown>{textContent}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Tool parts */}
        {toolParts.map((part, idx) => {
          const toolName =
            part.type === "dynamic-tool"
              ? (part as { toolName: string }).toolName
              : part.type.replace(/^tool-/, "");

          const state = (part as { state: string }).state;
          const output = (part as { output?: unknown }).output;

          if (state === "input-streaming" || state === "input-available") {
            return (
              <div
                key={`${part.toolCallId ?? idx}`}
                className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                {TOOL_LOADING_LABELS[toolName] ?? "Working..."}
              </div>
            );
          }

          if (state === "output-available" && output !== undefined) {
            return (
              <div key={`${part.toolCallId ?? idx}`} className="w-full max-w-2xl">
                <ToolResult toolName={toolName} result={output} onAppend={onAppend} />
              </div>
            );
          }

          if (state === "output-error") {
            return (
              <div
                key={`${part.toolCallId ?? idx}`}
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
              >
                Tool execution failed. Please try again.
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
