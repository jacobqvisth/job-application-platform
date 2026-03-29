"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ImproveDialog } from "./improve-dialog";
import { SaveDialog } from "./save-dialog";
import { CategoryBadge } from "@/components/answers/category-badge";
import Link from "next/link";
import type { AnswerCategory } from "@/lib/types/database";

interface Resume {
  id: string;
  name: string;
}

interface ScreeningQuestion {
  question: string;
  answer: string;
  tags: string[];
  pinned?: boolean;
}

interface LibraryMatch {
  predicted_question: string;
  category: string;
  canonical_question_id: string | null;
  canonical_text: string | null;
  best_answer: {
    id: string;
    answer_text: string;
    rating: string;
    tone: string;
    usage_count: number;
  } | null;
}

interface DraftResult {
  detected_company: string;
  detected_role: string;
  cover_letter: string;
  letter_type: "cover_letter" | "personligt_brev";
  language: "sv" | "en";
  tone: string;
  screening_questions: ScreeningQuestion[];
  key_requirements: string[];
  match_score: number;
  match_notes: string;
  resume_suggestions?: {
    summary?: { original: string; suggested: string; reason: string };
    experience_bullets?: Array<{
      jobIndex: number;
      bulletIndex: number;
      original: string;
      suggested: string;
      reason: string;
    }>;
    skills_reorder?: { suggested_order: string[]; reason: string };
    keywords_to_add?: string[];
  };
}

interface DraftWizardProps {
  resumes: Resume[];
  initialJobDescription?: string;
  initialCompany?: string;
  initialRole?: string;
}

const SWEDISH_KEYWORDS = [
  "vi söker", "arbetsuppgifter", "kvalifikationer", "anställning",
  "tjänst", "arbetsgivare", "meriterande", "erfarenhet av",
];

function detectLanguage(text: string): "sv" | "en" {
  const lower = text.toLowerCase();
  const matches = SWEDISH_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  return matches >= 2 ? "sv" : "en";
}

function ratingDotColor(rating: string): string {
  switch (rating) {
    case "strong":
      return "bg-green-500";
    case "good":
      return "bg-blue-500";
    case "needs_work":
      return "bg-yellow-500";
    default:
      return "bg-zinc-400";
  }
}

export function DraftWizard({
  resumes,
  initialJobDescription,
}: DraftWizardProps) {
  // Input state
  const [jobDescription, setJobDescription] = useState(
    initialJobDescription ?? ""
  );
  const [tone, setTone] = useState<string>("formal");
  const [language, setLanguage] = useState<"sv" | "en">("en");
  const [resumeId, setResumeId] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  // Library match state
  const [libraryMatches, setLibraryMatches] = useState<LibraryMatch[]>([]);
  const [pinnedAnswers, setPinnedAnswers] = useState<Record<string, string>>(
    {}
  );
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [dismissedCategories, setDismissedCategories] = useState<Set<string>>(
    new Set()
  );
  const matchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Result state
  const [result, setResult] = useState<DraftResult | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [screeningAnswers, setScreeningAnswers] = useState<ScreeningQuestion[]>(
    []
  );

  // UI state
  const [copiedCover, setCopiedCover] = useState(false);
  const [improveDialogOpen, setImproveDialogOpen] = useState(false);
  const [improveTarget, setImproveTarget] = useState<{
    type: "cover_letter" | "screening_answer";
    index?: number;
  } | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [regeneratingTone, setRegeneratingTone] = useState<string>(tone);

  // Auto-detect language when JD changes
  useEffect(() => {
    if (jobDescription.length >= 100) {
      setLanguage(detectLanguage(jobDescription));
    }
  }, [jobDescription]);

  // Debounced library match fetch
  useEffect(() => {
    if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current);

    if (jobDescription.length < 200) {
      setLibraryMatches([]);
      return;
    }

    matchDebounceRef.current = setTimeout(async () => {
      setLoadingMatches(true);
      try {
        const res = await fetch("/api/answers/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobDescription }),
        });
        if (res.ok) {
          const data = (await res.json()) as { matches: LibraryMatch[] };
          setLibraryMatches(data.matches ?? []);
          setDismissedCategories(new Set());
        }
      } catch {
        // Silently fail — library suggestions are non-critical
      } finally {
        setLoadingMatches(false);
      }
    }, 1500);

    return () => {
      if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current);
    };
  }, [jobDescription]);

  function pinAnswer(predictedQuestion: string, answerText: string) {
    setPinnedAnswers((prev) => ({ ...prev, [predictedQuestion]: answerText }));
  }

  function unpinAnswer(predictedQuestion: string) {
    setPinnedAnswers((prev) => {
      const next = { ...prev };
      delete next[predictedQuestion];
      return next;
    });
  }

  function skipMatch(category: string) {
    setDismissedCategories((prev) => new Set([...prev, category]));
  }

  const visibleMatches = libraryMatches.filter(
    (m) => m.best_answer !== null && !dismissedCategories.has(m.category)
  );

  async function handleGenerate() {
    if (!jobDescription.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/application/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          tone,
          language,
          resumeId: resumeId || undefined,
          pinnedAnswers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to generate application");
        return;
      }
      setResult(data);
      setCoverLetter(data.cover_letter);
      setScreeningAnswers(data.screening_questions);
      setRegeneratingTone(tone);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerateCoverLetter() {
    if (!jobDescription.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/application/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          tone: regeneratingTone,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to regenerate");
        return;
      }
      setCoverLetter(data.cover_letter);
      if (result) {
        setResult({
          ...result,
          cover_letter: data.cover_letter,
          tone: regeneratingTone,
        });
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyCoverLetter() {
    await navigator.clipboard.writeText(coverLetter);
    setCopiedCover(true);
    setTimeout(() => setCopiedCover(false), 2000);
  }

  function openImprove(
    type: "cover_letter" | "screening_answer",
    index?: number
  ) {
    setImproveTarget({ type, index });
    setImproveDialogOpen(true);
  }

  function handleImproved(improved: string) {
    if (!improveTarget) return;
    if (improveTarget.type === "cover_letter") {
      setCoverLetter(improved);
    } else if (
      improveTarget.type === "screening_answer" &&
      improveTarget.index !== undefined
    ) {
      setScreeningAnswers((prev) =>
        prev.map((q, i) =>
          i === improveTarget.index ? { ...q, answer: improved } : q
        )
      );
    }
  }

  function handleSaved() {
    // Reset to input state
    setResult(null);
    setCoverLetter("");
    setScreeningAnswers([]);
    setJobDescription("");
    setLibraryMatches([]);
    setPinnedAnswers({});
    setDismissedCategories(new Set());
  }

  const matchColor =
    result && result.match_score >= 75
      ? "text-green-600"
      : result && result.match_score >= 50
      ? "text-yellow-600"
      : "text-red-600";

  // — Input state —
  if (!result) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            Draft Application
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a job description → get your full application package
          </p>
        </div>

        <div className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="job-description">Job Description</Label>
            <Textarea
              id="job-description"
              placeholder="Paste the full job description here..."
              value={jobDescription}
              onChange={(e) =>
                setJobDescription(e.target.value.slice(0, 10000))
              }
              rows={12}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {loadingMatches && (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Checking your library...
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground text-right">
                {jobDescription.length.toLocaleString()} / 10,000 characters
              </p>
            </div>
          </div>

          {/* Library Suggestions Panel */}
          {visibleMatches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  From your Answer Library
                </span>
              </div>
              {visibleMatches.map((match) => {
                const isPinned = match.predicted_question in pinnedAnswers;
                return (
                  <div
                    key={match.category}
                    className="rounded-lg border bg-muted/30 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge
                        category={match.category as AnswerCategory}
                      />
                      <span className="text-xs text-muted-foreground">
                        {match.predicted_question}
                      </span>
                    </div>
                    {match.canonical_text &&
                      match.canonical_text !== match.predicted_question && (
                        <p className="text-xs font-medium">
                          {match.canonical_text}
                        </p>
                      )}
                    <p className="text-xs text-muted-foreground">
                      {match.best_answer!.answer_text.slice(0, 120)}
                      {match.best_answer!.answer_text.length > 120
                        ? "..."
                        : ""}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${ratingDotColor(match.best_answer!.rating)}`}
                        />
                        <span className="text-xs text-muted-foreground capitalize">
                          {match.best_answer!.rating}
                        </span>
                      </div>
                      {isPinned ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1.5 text-green-700 hover:text-green-800"
                          onClick={() => unpinAnswer(match.predicted_question)}
                        >
                          <Check className="h-3 w-3" />
                          Pinned — click to unpin
                        </Button>
                      ) : (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => skipMatch(match.category)}
                          >
                            Skip
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              pinAnswer(
                                match.predicted_question,
                                match.best_answer!.answer_text
                              )
                            }
                          >
                            Use this
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                {language === "sv" ? "Ton" : "Cover letter tone"}
                <span className="ml-2 text-xs text-muted-foreground">
                  {language === "sv" ? "🇸🇪 Svenska" : "🇬🇧 English"}
                </span>
              </Label>
              <div className="flex gap-2">
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {language === "sv" ? (
                      <>
                        <SelectItem value="formal">Formellt</SelectItem>
                        <SelectItem value="conversational">Personligt</SelectItem>
                        <SelectItem value="startup">Startup/Informellt</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="conversational">Conversational</SelectItem>
                        <SelectItem value="startup">Startup</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <div className="flex rounded-md border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setLanguage("sv")}
                    className={`px-2 py-1 text-sm transition-colors ${
                      language === "sv"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                    title="Svenska"
                  >
                    🇸🇪
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage("en")}
                    className={`px-2 py-1 text-sm transition-colors ${
                      language === "en"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                    title="English"
                  >
                    🇬🇧
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Resume to tailor (optional)</Label>
              {resumes.length > 0 ? (
                <Select value={resumeId} onValueChange={setResumeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select resume..." />
                  </SelectTrigger>
                  <SelectContent>
                    {resumes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
                  No resumes yet —{" "}
                  <Link href="/dashboard/resumes" className="ml-1 underline">
                    create one
                  </Link>
                </div>
              )}
            </div>
          </div>

          {initialJobDescription && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
              Pre-filled from job listing — review and generate your package.
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!jobDescription.trim() || generating}
            className="w-full"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating your application package...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Application Package
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // — Results state —
  const currentImproveContent =
    improveTarget?.type === "cover_letter"
      ? coverLetter
      : improveTarget?.index !== undefined
      ? (screeningAnswers[improveTarget.index]?.answer ?? "")
      : "";

  const currentImproveQuestion =
    improveTarget?.type === "screening_answer" &&
    improveTarget.index !== undefined
      ? screeningAnswers[improveTarget.index]?.question
      : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setResult(null)}
            className="mt-0.5 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {result.detected_company} — {result.detected_role}
            </h1>
            <p className={`mt-0.5 text-sm font-medium ${matchColor}`}>
              Match: {result.match_score}% — {result.match_notes}
            </p>
          </div>
        </div>
        <Button onClick={() => setSaveDialogOpen(true)} className="shrink-0">
          Save to Applications →
        </Button>
      </div>

      {/* Key Requirements */}
      {result.key_requirements.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Key requirements:
          </span>
          {result.key_requirements.map((req, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {req}
            </Badge>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="cover-letter">
        <TabsList>
          <TabsTrigger value="cover-letter">
            {result.letter_type === "personligt_brev" ? "Personligt Brev" : "Cover Letter"}
          </TabsTrigger>
          <TabsTrigger value="screening">Screening Q&amp;A</TabsTrigger>
          <TabsTrigger value="resume">Resume Suggestions</TabsTrigger>
        </TabsList>

        {/* Cover Letter Tab */}
        <TabsContent value="cover-letter" className="mt-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="shrink-0">Tone:</Label>
                <Select
                  value={regeneratingTone}
                  onValueChange={setRegeneratingTone}
                >
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {result.language === "sv" ? (
                      <>
                        <SelectItem value="formal">Formellt</SelectItem>
                        <SelectItem value="conversational">Personligt</SelectItem>
                        <SelectItem value="startup">Startup/Informellt</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="conversational">Conversational</SelectItem>
                        <SelectItem value="startup">Startup</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRegenerateCoverLetter}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                Regenerate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openImprove("cover_letter")}
                disabled={generating}
              >
                Improve...
              </Button>
            </div>

            <Textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={18}
              className="resize-none font-mono text-sm"
            />

            <Button variant="outline" size="sm" onClick={copyCoverLetter}>
              {copiedCover ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy to clipboard
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Screening Q&A Tab */}
        <TabsContent value="screening" className="mt-4">
          <div className="space-y-4">
            {screeningAnswers.map((qa, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      {qa.pinned ? (
                        <Badge className="bg-green-100 text-green-800 border-0 text-xs gap-1 hover:bg-green-100">
                          <BookOpen className="h-3 w-3" />
                          From library
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs gap-1 text-muted-foreground border-muted"
                        >
                          <Sparkles className="h-3 w-3" />
                          Generated
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-snug">
                      {qa.question}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => openImprove("screening_answer", i)}
                  >
                    Improve...
                  </Button>
                </div>
                <Textarea
                  value={qa.answer}
                  onChange={(e) =>
                    setScreeningAnswers((prev) =>
                      prev.map((q, idx) =>
                        idx === i ? { ...q, answer: e.target.value } : q
                      )
                    )
                  }
                  rows={4}
                  className="resize-none text-sm"
                />
                {qa.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {qa.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Resume Suggestions Tab */}
        <TabsContent value="resume" className="mt-4">
          {result.resume_suggestions ? (
            <div className="space-y-5">
              {/* Summary suggestion */}
              {result.resume_suggestions.summary && (
                <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                  <h3 className="font-semibold text-sm">Summary</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Original
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {result.resume_suggestions.summary.original}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-green-600 uppercase tracking-wide">
                        Suggested
                      </p>
                      <p className="text-sm">
                        {result.resume_suggestions.summary.suggested}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    {result.resume_suggestions.summary.reason}
                  </p>
                </div>
              )}

              {/* Bullet suggestions */}
              {result.resume_suggestions.experience_bullets &&
                result.resume_suggestions.experience_bullets.length > 0 && (
                  <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                    <h3 className="font-semibold text-sm">
                      Experience Bullet Improvements
                    </h3>
                    <div className="space-y-4">
                      {result.resume_suggestions.experience_bullets.map(
                        (b, i) => (
                          <div
                            key={i}
                            className="grid gap-2 sm:grid-cols-2 text-sm"
                          >
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                Original
                              </p>
                              <p className="text-muted-foreground">
                                • {b.original}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">
                                Suggested
                              </p>
                              <p>• {b.suggested}</p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {/* Keywords */}
              {result.resume_suggestions.keywords_to_add &&
                result.resume_suggestions.keywords_to_add.length > 0 && (
                  <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                    <h3 className="font-semibold text-sm">Keywords to Add</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.resume_suggestions.keywords_to_add.map((kw) => (
                        <Badge key={kw} variant="secondary">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-10 shadow-sm text-center space-y-3">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Select a resume on the input form to see tailoring suggestions.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/resumes">Go to Resumes</Link>
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Improve dialog */}
      <ImproveDialog
        open={improveDialogOpen}
        onOpenChange={setImproveDialogOpen}
        type={improveTarget?.type ?? "cover_letter"}
        content={currentImproveContent}
        question={currentImproveQuestion}
        jobDescription={jobDescription}
        onImproved={handleImproved}
      />

      {/* Save dialog */}
      <SaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultCompany={result.detected_company}
        defaultRole={result.detected_role}
        jobDescription={jobDescription}
        coverLetter={coverLetter}
        screeningAnswers={screeningAnswers}
        onSaved={handleSaved}
      />
    </div>
  );
}
