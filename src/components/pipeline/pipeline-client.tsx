"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  Plug,
  Search,
  PenLine,
  MapPin,
  Loader2,
  MoreHorizontal,
  Trash2,
  Sparkles,
  Check,
  X,
  Zap,
  AlertTriangle,
  Pencil,
  Layers,
} from "lucide-react";
import type { JobEmailSource } from "@/lib/types/database";
import type { LeadPreferences } from "@/lib/jobs/preferences";
import type { PipelineItem, PipelineStats, PipelineSource, PipelineStatus } from "@/lib/data/pipeline";
import {
  movePipelineItem,
  bulkMovePipelineItems,
  deletePipelineItem,
} from "@/app/(protected)/dashboard/pipeline/actions";
import {
  approveJobLead,
  rejectJobLead,
  toggleAutoExtract,
  toggleTrustedSource,
  deleteJobEmailSource,
  updateSourceDisplayName,
} from "@/app/(protected)/dashboard/job-leads/actions";
import { ApplicationDetail } from "@/components/applications/application-detail";
import { AddApplicationDialog } from "@/components/applications/add-application-dialog";
import type { ApplicationWithEvents } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = "all" | PipelineStatus;
type SortField = "title" | "company" | "matchScore" | "foundAt" | "lastActivity" | "pipelineStatus";
type SortDir = "asc" | "desc";

// ─── Status config ────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string;
  classes: string;
  dotColor: string;
}

const STATUS_CONFIG: Record<PipelineStatus, StatusConfig> = {
  lead:       { label: "Lead",       classes: "bg-orange-100 text-orange-800",  dotColor: "bg-orange-500" },
  saved:      { label: "Saved",      classes: "bg-zinc-100 text-zinc-600",      dotColor: "bg-zinc-400" },
  applied:    { label: "Applied",    classes: "bg-blue-100 text-blue-800",      dotColor: "bg-blue-500" },
  screening:  { label: "Screening",  classes: "bg-yellow-100 text-yellow-800",  dotColor: "bg-yellow-500" },
  interview:  { label: "Interview",  classes: "bg-purple-100 text-purple-800",  dotColor: "bg-purple-500" },
  offer:      { label: "Offer",      classes: "bg-green-100 text-green-800",    dotColor: "bg-green-500" },
  rejected:   { label: "Rejected",   classes: "bg-red-100 text-red-700",        dotColor: "bg-red-500" },
  withdrawn:  { label: "Withdrawn",  classes: "bg-zinc-100 text-zinc-500",      dotColor: "bg-zinc-300" },
};

const ALL_STATUSES: PipelineStatus[] = [
  "lead", "saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PipelineStatusBadge({ status }: { status: PipelineStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", cfg.classes)}>
      <span className={cn("size-1.5 rounded-full", cfg.dotColor)} />
      {cfg.label}
    </span>
  );
}

function MatchBadge({ score, reason }: { score: number | null; reason: string | null }) {
  if (!score) return <span className="text-xs text-muted-foreground">—</span>;
  if (score >= 80) return (
    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800" title={reason ?? undefined}>
      {score}%
    </span>
  );
  if (score >= 50) return (
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800" title={reason ?? undefined}>
      {score}%
    </span>
  );
  return (
    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground" title={reason ?? undefined}>
      {score}%
    </span>
  );
}

function RemoteTypeBadge({ type }: { type: string }) {
  if (type === "remote") return (
    <Badge variant="outline" className="border-green-300 text-green-700 text-[10px] px-1.5 py-0">Remote</Badge>
  );
  if (type === "hybrid") return (
    <Badge variant="outline" className="border-blue-300 text-blue-700 text-[10px] px-1.5 py-0">Hybrid</Badge>
  );
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Onsite</Badge>;
}

function SourceIcon({ source }: { source: PipelineSource }) {
  const labels: Record<PipelineSource, string> = {
    email: "From email",
    extension: "From extension",
    search: "From search",
    manual: "Added manually",
  };
  const icons: Record<PipelineSource, React.ReactNode> = {
    email:     <Mail className="size-3.5" />,
    extension: <Plug className="size-3.5" />,
    search:    <Search className="size-3.5" />,
    manual:    <PenLine className="size-3.5" />,
  };
  return (
    <span title={labels[source]} className="text-muted-foreground flex items-center justify-center">
      {icons[source]}
    </span>
  );
}

function SortableHeader({
  field, label, currentField, currentDir, onSort, className,
}: {
  field: SortField;
  label: string;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = currentField === field;
  return (
    <th
      className={cn("px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground whitespace-nowrap", className)}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          currentDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
        ) : null}
      </span>
    </th>
  );
}

// ─── Inline status select for table rows ──────────────────────────────────────

function StatusSelect({
  item,
  onChange,
  disabled,
}: {
  item: PipelineItem;
  onChange: (newStatus: PipelineStatus) => void;
  disabled: boolean;
}) {
  const cfg = STATUS_CONFIG[item.pipelineStatus];
  return (
    <div className="relative inline-flex">
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", cfg.classes)}>
        <span className={cn("size-1.5 rounded-full", cfg.dotColor)} />
        {cfg.label}
      </span>
      <select
        disabled={disabled}
        value={item.pipelineStatus}
        onChange={(e) => onChange(e.target.value as PipelineStatus)}
        className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        aria-label="Change status"
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Lead detail sheet (for items with no applicationId) ─────────────────────

function LeadDetailSheet({
  item,
  open,
  onOpenChange,
  onApprove,
  onReject,
}: {
  item: PipelineItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApprove: (item: PipelineItem) => void;
  onReject: (item: PipelineItem) => void;
}) {
  if (!item) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-xl">{item.title}</SheetTitle>
          <p className="text-muted-foreground">{item.company}</p>
        </SheetHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="flex flex-wrap gap-2 items-center">
            <PipelineStatusBadge status={item.pipelineStatus} />
            {item.matchScore && <MatchBadge score={item.matchScore} reason={item.matchReason} />}
            {item.location && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />{item.location}
              </span>
            )}
            {item.remoteType && item.remoteType !== "unknown" && (
              <RemoteTypeBadge type={item.remoteType} />
            )}
          </div>

          {/* Match reason */}
          {item.matchReason && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {item.matchReason}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {item.url && (
              <Button variant="outline" size="sm" asChild>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5 mr-1.5" />
                  Open Job
                </a>
              </Button>
            )}
            {item.jobListingId && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/dashboard/application-studio?job=${item.jobListingId}`}>
                  <Sparkles className="size-3.5 mr-1.5" />
                  Application Studio
                </a>
              </Button>
            )}
            {item.pipelineStatus === "lead" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-700 border-green-300 hover:bg-green-50"
                  onClick={() => onApprove(item)}
                >
                  <Check className="size-3.5 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onReject(item)}
                >
                  <X className="size-3.5 mr-1" />
                  Reject
                </Button>
              </>
            )}
          </div>

          {/* Job description */}
          {item.jobDescription && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Job Description</p>
              <div className="rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                {item.jobDescription}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Learned Sources (lifted from job-leads-client) ───────────────────────────

function approvalRate(approved: number, rejected: number): number | null {
  const total = approved + rejected;
  if (total < 5) return null;
  return Math.round((approved / total) * 100);
}

function sortedSources(sources: JobEmailSource[]): JobEmailSource[] {
  return [...sources].sort((a, b) => {
    const rateA = approvalRate(a.total_approved, a.total_rejected);
    const rateB = approvalRate(b.total_approved, b.total_rejected);
    if (rateA !== null && rateB === null) return -1;
    if (rateA === null && rateB !== null) return 1;
    if (rateA !== null && rateB !== null) return rateB - rateA;
    return 0;
  });
}

function LearnedSources({
  sources,
  onToggleAutoExtract,
  onToggleTrusted,
  onDeleteSource,
}: {
  sources: JobEmailSource[];
  onToggleAutoExtract: (id: string, enabled: boolean) => void;
  onToggleTrusted: (id: string, enabled: boolean) => void;
  onDeleteSource: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  if (sources.length === 0) return null;

  async function handleSaveName(sourceId: string) {
    const result = await updateSourceDisplayName(sourceId, editValue);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Display name updated");
      setEditingId(null);
      window.location.reload();
    }
  }

  return (
    <div className="mt-8">
      <button
        className="flex items-center gap-2 text-lg font-semibold mb-3 hover:text-foreground/80 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        Learned Sources
        <Badge variant="secondary" className="text-xs ml-1">{sources.length}</Badge>
      </button>
      {open && (
        <div className="divide-y rounded-lg border">
          {sortedSources(sources).map((source) => {
            const rate = approvalRate(source.total_approved, source.total_rejected);
            const totalDecisions = source.total_approved + source.total_rejected;
            const isLowPerformance = rate !== null && rate < 50 && totalDecisions >= 10;
            const isEditing = editingId === source.id;
            const canEnableTrusted = rate !== null && rate >= 80 && totalDecisions >= 10;

            return (
              <div key={source.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSaveName(source.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveName(source.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="text-sm font-medium border-b border-border bg-transparent focus:outline-none focus:border-primary w-48"
                      />
                    ) : (
                      <>
                        <span className="text-sm font-medium truncate">
                          {source.display_name || source.sender_email}
                        </span>
                        <button
                          onClick={() => { setEditingId(source.id); setEditValue(source.display_name || source.sender_email); }}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          title="Edit display name"
                        >
                          <Pencil className="size-3" />
                        </button>
                      </>
                    )}
                    {isLowPerformance && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 shrink-0">
                        <AlertTriangle className="size-3" />
                        Low approval rate
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{source.sender_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.total_extracted} extracted · {source.total_approved} approved · {source.total_rejected} rejected
                    {rate !== null ? ` · ${rate}% approval` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={source.is_auto_extract}
                      onChange={() => onToggleAutoExtract(source.id, !source.is_auto_extract)}
                      className="rounded"
                    />
                    Auto-extract
                  </label>
                  <label
                    className={`flex items-center gap-2 text-xs ${canEnableTrusted ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                    title={canEnableTrusted ? "Enable trusted auto-approve" : "Need ≥80% approval rate and 10+ decisions"}
                  >
                    <input
                      type="checkbox"
                      checked={source.is_trusted}
                      onChange={() => onToggleTrusted(source.id, !source.is_trusted)}
                      disabled={!canEnableTrusted && !source.is_trusted}
                      className="rounded"
                    />
                    Trusted
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSource(source.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Preferences Panel (lifted from job-leads-client) ─────────────────────────

function PreferencesPanel({
  preferences,
  totalDecisions,
}: {
  preferences: LeadPreferences | null;
  totalDecisions: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  async function handleAnalyze() {
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/jobs/analyze-preferences", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Analysis failed");
      } else {
        toast.success("Preferences updated");
        router.refresh();
      }
    } catch {
      toast.error("Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const hasPreferences = preferences !== null;
  const notEnoughData = !hasPreferences && totalDecisions < 5;

  return (
    <div className="mt-6">
      <button
        className="flex items-center gap-2 text-lg font-semibold mb-3 hover:text-foreground/80 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        My Preferences
      </button>
      {open && (
        <div>
          {!notEnoughData && (
            <div className="flex justify-end mb-3">
              <Button
                variant={hasPreferences ? "outline" : "default"}
                size="sm"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <><Loader2 className="size-3.5 mr-1.5 animate-spin" />Analyzing…</>
                ) : hasPreferences ? "Re-analyze" : "Analyze My Preferences"}
              </Button>
            </div>
          )}
          {notEnoughData ? (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Not enough decisions yet. Approve or reject at least 5 leads to generate preferences.
            </div>
          ) : hasPreferences ? (
            <div className="rounded-lg border divide-y">
              <div className="px-4 py-3 space-y-2">
                {preferences.positive_signals.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Positive signals</p>
                    <div className="flex flex-wrap gap-1.5">
                      {preferences.positive_signals.map((s) => (
                        <span key={s} className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {preferences.negative_signals.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Negative signals</p>
                    <div className="flex flex-wrap gap-1.5">
                      {preferences.negative_signals.map((s) => (
                        <span key={s} className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {preferences.preferred_companies.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Preferred companies</p>
                    <div className="flex flex-wrap gap-1.5">
                      {preferences.preferred_companies.map((c) => (
                        <span key={c} className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                {preferences.preferred_locations.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Preferred locations</p>
                    <div className="flex flex-wrap gap-1.5">
                      {preferences.preferred_locations.map((l) => (
                        <span key={l} className="inline-flex rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">{l}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Based on {preferences.decision_count} decisions{preferences.last_analyzed_at ? ` · last analyzed ${timeAgo(preferences.last_analyzed_at)}` : ""}</span>
                <span className={preferences.decision_count >= 10 ? "text-green-600" : "text-amber-600"}>
                  {preferences.decision_count >= 10 ? "Auto-approve enabled when source is trusted" : `${preferences.decision_count}/10 decisions for auto-approve`}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                You have {totalDecisions} decision{totalDecisions !== 1 ? "s" : ""}. Click &ldquo;Analyze My Preferences&rdquo; to extract your job preferences.
              </p>
              {totalDecisions < 10 && (
                <p className="text-xs text-muted-foreground">{totalDecisions}/10 decisions needed for auto-approve</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PipelineClientProps {
  initialItems: PipelineItem[];
  initialStats: PipelineStats;
  sources: JobEmailSource[];
  initialPreferences: LeadPreferences | null;
}

export function PipelineClient({
  initialItems,
  initialStats,
  sources: initialSources,
  initialPreferences,
}: PipelineClientProps) {
  const [items, setItems] = useState(initialItems);
  const [stats, setStats] = useState(initialStats);
  const [sources] = useState(initialSources);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastActivity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Detail sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<PipelineItem | null>(null);
  const [loadedApp, setLoadedApp] = useState<ApplicationWithEvents | null>(null);
  const [appSheetOpen, setAppSheetOpen] = useState(false);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredItems = items.filter((item) => {
    if (filterTab !== "all" && item.pipelineStatus !== filterTab) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.title.toLowerCase().includes(q) || item.company.toLowerCase().includes(q);
    }
    return true;
  });

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sortedItems = [...filteredItems].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "matchScore":    return dir * ((a.matchScore ?? 0) - (b.matchScore ?? 0));
      case "foundAt":       return dir * (new Date(a.foundAt).getTime() - new Date(b.foundAt).getTime());
      case "lastActivity":  return dir * (new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime());
      case "title":         return dir * a.title.localeCompare(b.title);
      case "company":       return dir * a.company.localeCompare(b.company);
      case "pipelineStatus":return dir * a.pipelineStatus.localeCompare(b.pipelineStatus);
      default: return 0;
    }
  });

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  // ── Selection ──────────────────────────────────────────────────────────────
  const allVisibleKeys = sortedItems.map((i) => i.applicationId ?? i.jobListingId ?? "");
  const allSelected = allVisibleKeys.length > 0 && allVisibleKeys.every((k) => selectedIds.has(k));

  function itemKey(item: PipelineItem) {
    return item.applicationId ?? item.jobListingId ?? "";
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleKeys));
    }
  }

  function toggleSelect(item: PipelineItem) {
    const key = itemKey(item);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Status change ──────────────────────────────────────────────────────────
  function handleStatusChange(item: PipelineItem, newStatus: PipelineStatus) {
    if (newStatus === item.pipelineStatus) return;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        itemKey(i) === itemKey(item) ? { ...i, pipelineStatus: newStatus } : i
      )
    );

    // Update stats
    setStats((prev) => {
      const next = { ...prev, byStatus: { ...prev.byStatus } };
      next.byStatus[item.pipelineStatus] = Math.max(0, (next.byStatus[item.pipelineStatus] ?? 0) - 1);
      next.byStatus[newStatus] = (next.byStatus[newStatus] ?? 0) + 1;
      return next;
    });

    startTransition(async () => {
      const result = await movePipelineItem(
        item.jobListingId,
        item.applicationId,
        item.pipelineStatus,
        newStatus
      );
      if (!result.success) {
        toast.error(result.error ?? "Failed to update status");
        // Revert
        setItems((prev) =>
          prev.map((i) =>
            itemKey(i) === itemKey(item) ? { ...i, pipelineStatus: item.pipelineStatus } : i
          )
        );
        setStats((prev) => {
          const next = { ...prev, byStatus: { ...prev.byStatus } };
          next.byStatus[newStatus] = Math.max(0, (next.byStatus[newStatus] ?? 0) - 1);
          next.byStatus[item.pipelineStatus] = (next.byStatus[item.pipelineStatus] ?? 0) + 1;
          return next;
        });
      } else {
        toast.success("Status updated");
        // If a new application was created, update applicationId
        if (result.applicationId && !item.applicationId) {
          setItems((prev) =>
            prev.map((i) =>
              itemKey(i) === itemKey(item) ? { ...i, applicationId: result.applicationId ?? null } : i
            )
          );
        }
      }
    });
  }

  // ── Row click → detail sheet ──────────────────────────────────────────────
  async function handleRowClick(item: PipelineItem) {
    setSheetItem(item);
    if (item.applicationId) {
      // Load full ApplicationWithEvents client-side
      const supabase = createClient();
      const { data } = await supabase
        .from("applications")
        .select("*, application_events(*)")
        .eq("id", item.applicationId)
        .order("created_at", { referencedTable: "application_events", ascending: false })
        .single();
      if (data) {
        setLoadedApp(data as ApplicationWithEvents);
        setAppSheetOpen(true);
      } else {
        setSheetOpen(true);
      }
    } else {
      setSheetOpen(true);
    }
  }

  // ── Lead approve/reject from sheet ─────────────────────────────────────────
  function handleLeadApprove(item: PipelineItem) {
    startTransition(async () => {
      const result = await approveJobLead(item.jobListingId!);
      if (result.success) {
        toast.success("Lead approved");
        setItems((prev) =>
          prev.map((i) => itemKey(i) === itemKey(item) ? { ...i, pipelineStatus: "saved" } : i)
        );
        setSheetOpen(false);
      } else {
        toast.error(result.error ?? "Failed to approve");
      }
    });
  }

  function handleLeadReject(item: PipelineItem) {
    startTransition(async () => {
      const result = await rejectJobLead(item.jobListingId!);
      if (result.success) {
        toast.success("Lead rejected");
        setItems((prev) =>
          prev.map((i) => itemKey(i) === itemKey(item) ? { ...i, pipelineStatus: "rejected" } : i)
        );
        setSheetOpen(false);
      } else {
        toast.error(result.error ?? "Failed to reject");
      }
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(item: PipelineItem) {
    const result = await deletePipelineItem(item.jobListingId, item.applicationId);
    if (result.success) {
      toast.success("Removed from pipeline");
      setItems((prev) => prev.filter((i) => itemKey(i) !== itemKey(item)));
      setStats((prev) => {
        const next = { ...prev, byStatus: { ...prev.byStatus } };
        next.byStatus[item.pipelineStatus] = Math.max(0, (next.byStatus[item.pipelineStatus] ?? 0) - 1);
        next.total = Math.max(0, next.total - 1);
        return next;
      });
    } else {
      toast.error(result.error ?? "Failed to delete");
    }
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────
  function getSelectedItems(): PipelineItem[] {
    return items.filter((i) => selectedIds.has(itemKey(i)));
  }

  async function handleBulkMove(newStatus: PipelineStatus) {
    const selected = getSelectedItems();
    const result = await bulkMovePipelineItems(
      selected.map((i) => ({ jobListingId: i.jobListingId, applicationId: i.applicationId, currentStatus: i.pipelineStatus })),
      newStatus
    );
    if (result.success) {
      toast.success(`${selected.length} items updated`);
      window.location.reload();
    } else {
      toast.error(result.error ?? "Bulk update failed");
    }
  }

  // ── Source handlers ────────────────────────────────────────────────────────
  async function handleToggleAutoExtract(sourceId: string, enabled: boolean) {
    const result = await toggleAutoExtract(sourceId, enabled);
    if (result.success) {
      toast.success(enabled ? "Auto-extract enabled" : "Auto-extract disabled");
      window.location.reload();
    } else {
      toast.error(result.error ?? "Failed to update");
    }
  }

  async function handleToggleTrusted(sourceId: string, enabled: boolean) {
    const result = await toggleTrustedSource(sourceId, enabled);
    if (result.success) {
      toast.success(enabled ? "Trusted auto-approve enabled" : "Trusted auto-approve disabled");
      window.location.reload();
    } else {
      toast.error(result.error ?? "Failed to update");
    }
  }

  async function handleDeleteSource(sourceId: string) {
    const result = await deleteJobEmailSource(sourceId);
    if (result.success) {
      toast.success("Source removed");
      window.location.reload();
    } else {
      toast.error(result.error ?? "Failed to delete");
    }
  }

  // ── Filter tabs ────────────────────────────────────────────────────────────
  const FILTER_TABS: { value: FilterTab; label: string; count: number }[] = [
    { value: "all",       label: "All",       count: stats.total },
    { value: "lead",      label: "Lead",      count: stats.byStatus.lead },
    { value: "saved",     label: "Saved",     count: stats.byStatus.saved },
    { value: "applied",   label: "Applied",   count: stats.byStatus.applied },
    { value: "screening", label: "Screening", count: stats.byStatus.screening },
    { value: "interview", label: "Interview", count: stats.byStatus.interview },
    { value: "offer",     label: "Offer",     count: stats.byStatus.offer },
    { value: "rejected",  label: "Rejected",  count: stats.byStatus.rejected },
    { value: "withdrawn", label: "Withdrawn", count: stats.byStatus.withdrawn },
  ];

  const totalDecisions = (stats.byStatus.saved ?? 0) + (stats.byStatus.rejected ?? 0);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <Button
              key={tab.value}
              variant={filterTab === tab.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterTab(tab.value)}
              className="gap-1.5"
            >
              {tab.label}
              <Badge
                variant={filterTab === tab.value ? "secondary" : "outline"}
                className="text-[10px] px-1.5 py-0 h-4"
              >
                {tab.count}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Search + Add button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by title or company…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)}>
            <PenLine className="size-3.5 mr-1.5" />
            Add Job
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {sortedItems.length === 0 ? (
        items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <Layers className="mb-3 size-10 text-muted-foreground/40" />
            <p className="mb-1 font-medium">No jobs in your pipeline yet</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Add jobs from Job Discovery, email digests, or the Chrome extension.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard/emails">Browse emails</a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard/jobs">Discover jobs</a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">No jobs match your current filter.</p>
          </div>
        )
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="w-10 px-3 py-2">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" />
                </th>
                <SortableHeader field="title"         label="Job / Company" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="flex-1" />
                <th className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Location</th>
                <SortableHeader field="matchScore"    label="Score"         currentField={sortField} currentDir={sortDir} onSort={handleSort} className="w-20 hidden md:table-cell" />
                <th className="w-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Src</th>
                <SortableHeader field="pipelineStatus" label="Status"       currentField={sortField} currentDir={sortDir} onSort={handleSort} className="w-36" />
                <SortableHeader field="foundAt"       label="Found"         currentField={sortField} currentDir={sortDir} onSort={handleSort} className="w-20 hidden md:table-cell" />
                <th className="w-16 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedItems.map((item) => {
                const key = itemKey(item);
                return (
                  <tr key={key} className="hover:bg-muted/50 transition-colors">
                    {/* Checkbox */}
                    <td className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(key)}
                        onChange={() => toggleSelect(item)}
                        className="rounded"
                      />
                    </td>

                    {/* Job / Company */}
                    <td className="px-3 py-2.5 min-w-0">
                      <div className="flex items-center gap-1 min-w-0">
                        <button
                          className="font-medium text-left hover:underline truncate max-w-xs"
                          onClick={() => handleRowClick(item)}
                        >
                          {item.title}
                        </button>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.company}</p>
                    </td>

                    {/* Location */}
                    <td className="w-28 px-3 py-2.5 hidden sm:table-cell">
                      <div className="flex flex-col gap-0.5">
                        {item.location && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3 shrink-0" />
                            <span className="truncate max-w-[80px]">{item.location}</span>
                          </span>
                        )}
                        {item.remoteType && item.remoteType !== "unknown" && (
                          <RemoteTypeBadge type={item.remoteType} />
                        )}
                      </div>
                    </td>

                    {/* Score */}
                    <td className="w-20 px-3 py-2.5 hidden md:table-cell">
                      <MatchBadge score={item.matchScore} reason={item.matchReason} />
                    </td>

                    {/* Source icon */}
                    <td className="w-10 px-3 py-2.5 hidden sm:table-cell">
                      <SourceIcon source={item.source} />
                      {item.autoApproved && (
                        <span title={item.autoApproveReason ?? "Auto-approved"}>
                          <Zap className="size-3 text-blue-500 ml-0.5 inline" />
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="w-36 px-3 py-2.5">
                      <StatusSelect
                        item={item}
                        onChange={(newStatus) => handleStatusChange(item, newStatus)}
                        disabled={isPending}
                      />
                    </td>

                    {/* Found */}
                    <td className="w-20 px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                      {timeAgo(item.foundAt)}
                    </td>

                    {/* Actions */}
                    <td className="w-16 px-3 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {item.url && (
                            <DropdownMenuItem asChild>
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <ExternalLink className="size-3.5" />
                                Open URL
                              </a>
                            </DropdownMenuItem>
                          )}
                          {item.jobListingId && (
                            <DropdownMenuItem asChild>
                              <a href={`/dashboard/application-studio?job=${item.jobListingId}`} className="flex items-center gap-2">
                                <Sparkles className="size-3.5" />
                                Application Studio
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="size-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border bg-background px-5 py-3 shadow-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleBulkMove("saved")} className="text-zinc-700">
            Move to Saved
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkMove("applied")} className="text-blue-700 border-blue-300">
            Move to Applied
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkMove("rejected")} className="text-destructive border-destructive/30">
            <X className="size-3 mr-1" />
            Reject
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Deselect All
          </Button>
        </div>
      )}

      {/* Lead detail sheet (no applicationId) */}
      <LeadDetailSheet
        item={sheetItem}
        open={sheetOpen}
        onOpenChange={(v) => { setSheetOpen(v); if (!v) setSheetItem(null); }}
        onApprove={handleLeadApprove}
        onReject={handleLeadReject}
      />

      {/* Application detail sheet (has applicationId) */}
      <ApplicationDetail
        application={loadedApp}
        open={appSheetOpen}
        onOpenChange={(v) => { setAppSheetOpen(v); if (!v) { setLoadedApp(null); setSheetItem(null); } }}
      />

      {/* Add Job dialog */}
      <AddApplicationDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      {/* Learned Sources */}
      <LearnedSources
        sources={sources}
        onToggleAutoExtract={handleToggleAutoExtract}
        onToggleTrusted={handleToggleTrusted}
        onDeleteSource={handleDeleteSource}
      />

      {/* My Preferences */}
      <PreferencesPanel
        preferences={initialPreferences}
        totalDecisions={totalDecisions}
      />
    </div>
  );
}
