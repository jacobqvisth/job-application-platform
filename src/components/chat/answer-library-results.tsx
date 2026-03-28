"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import type { SearchAnswerLibraryResult, CanonicalAnswer } from "@/lib/chat/types";

interface Props {
  data: SearchAnswerLibraryResult;
}

const RATING_COLORS: Record<string, string> = {
  strong: "bg-green-100 text-green-700",
  good: "bg-blue-100 text-blue-700",
  needs_work: "bg-yellow-100 text-yellow-700",
  untested: "bg-zinc-100 text-zinc-600",
};

function AnswerCard({ answer }: { answer: CanonicalAnswer }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(answer.answer);
    setCopied(true);
    toast.success("Answer copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const preview = answer.answer.slice(0, 120);
  const hasMore = answer.answer.length > 120;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug flex-1">{answer.question}</p>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              RATING_COLORS[answer.rating] ?? RATING_COLORS.untested
            }`}
          >
            {answer.rating}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
            {answer.category}
          </Badge>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {expanded ? answer.answer : preview}
          {!expanded && hasMore ? "..." : ""}
        </p>
        <div className="flex items-center gap-2 mt-2">
          {hasMore && (
            <button
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" /> Show full answer
                </>
              )}
            </button>
          )}
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs ml-auto" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AnswerLibraryResults({ data }: Props) {
  if (data.answers.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            No answers found
            {data.query ? ` for "${data.query}"` : ""}.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/answers">Go to Answer Library →</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">
          Answer Library
          {data.query ? ` — "${data.query}"` : ""}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{data.total} answer{data.total !== 1 ? "s" : ""} found</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {data.answers.map((answer) => (
          <AnswerCard key={answer.id} answer={answer} />
        ))}
        <Button asChild size="sm" variant="outline" className="w-full text-xs mt-2">
          <Link href="/dashboard/answers">View full Answer Library →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
