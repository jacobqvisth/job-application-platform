"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Sparkles,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { ApplicationPackageData } from "@/lib/chat/types";

interface Props {
  data: ApplicationPackageData;
  onAppend?: ((content: string) => void) | undefined;
}

function matchBadgeColor(score: number) {
  if (score >= 85) return "bg-green-100 text-green-700";
  if (score >= 60) return "bg-yellow-100 text-yellow-700";
  return "bg-zinc-100 text-zinc-600";
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function ScreeningAnswerCard({
  qa,
}: {
  qa: { question: string; answer: string; source?: string };
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(qa.answer);

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-foreground leading-snug">{qa.question}</p>
        {qa.source === "answer_library" && (
          <Badge variant="secondary" className="text-xs shrink-0 flex items-center gap-1">
            <BookOpen className="h-2.5 w-2.5" />
            Library
          </Badge>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="text-xs min-h-20 resize-none"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-6 text-xs" onClick={() => setEditing(false)}>
              Done
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs"
              onClick={() => {
                setText(qa.answer);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="group relative">
          <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
          <div className="flex gap-1 mt-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            <CopyButton text={text} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ApplicationPackage({ data }: Props) {
  const [coverExpanded, setCoverExpanded] = useState(false);
  const [resumeExpanded, setResumeExpanded] = useState(true);

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-sm font-semibold">
              Application Package
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.role} at {data.company}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${matchBadgeColor(data.matchScore)}`}
          >
            <Sparkles className="h-3 w-3" />
            {data.matchScore}% match
          </span>
        </div>
        {data.jobSaved && (
          <p className="text-xs text-green-600 mt-1">✓ Saved to your application tracker</p>
        )}
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Resume Changes */}
        {data.resumeChanges.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1 text-xs font-semibold w-full text-left"
              onClick={() => setResumeExpanded(!resumeExpanded)}
            >
              Resume Tailoring Tips
              {resumeExpanded ? (
                <ChevronUp className="h-3 w-3 ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-auto" />
              )}
            </button>
            {resumeExpanded && (
              <ul className="mt-2 space-y-1">
                {data.resumeChanges.map((change, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5 shrink-0">→</span>
                    {change}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Cover Letter */}
        {data.coverLetter && (
          <div>
            <div className="flex items-center justify-between">
              <button
                className="flex items-center gap-1 text-xs font-semibold"
                onClick={() => setCoverExpanded(!coverExpanded)}
              >
                Cover Letter
                {coverExpanded ? (
                  <ChevronUp className="h-3 w-3 ml-1" />
                ) : (
                  <ChevronDown className="h-3 w-3 ml-1" />
                )}
              </button>
              <CopyButton text={data.coverLetter} />
            </div>
            {coverExpanded && (
              <div className="mt-2 rounded-lg bg-muted/40 p-3">
                <p className="text-xs leading-relaxed whitespace-pre-line">{data.coverLetter}</p>
              </div>
            )}
          </div>
        )}

        {/* Screening Answers */}
        {data.screeningAnswers.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2">
              Screening Question Answers ({data.screeningAnswers.length})
            </p>
            <div className="space-y-2">
              {data.screeningAnswers.map((qa, i) => (
                <ScreeningAnswerCard key={i} qa={qa} />
              ))}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex flex-wrap gap-2 pt-1 border-t">
          {data.applicationId ? (
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href={`/dashboard/applications`}>
                <ExternalLink className="h-3 w-3 mr-1" />
                View in tracker
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href="/dashboard/resumes">Edit Resume →</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
