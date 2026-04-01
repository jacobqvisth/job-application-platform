"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Target,
  Check,
  X,
  Undo2,
  Building2,
  MapPin,
  Mail,
  Search,
  ExternalLink,
  Trash2,
  Loader2,
  Pencil,
  AlertTriangle,
  Zap,
} from "lucide-react";
import type { JobListing, JobEmailSource, LeadStatus } from "@/lib/types/database";
import type { LeadPreferences } from "@/lib/jobs/preferences";
import type { JobLeadStats } from "@/lib/data/job-leads";
import {
  approveJobLead,
  rejectJobLead,
  undoRejectJobLead,
  bulkApproveJobLeads,
  bulkRejectJobLeads,
  toggleAutoExtract,
  toggleTrustedSource,
  deleteJobEmailSource,
  updateSourceDisplayName,
} from "@/app/(protected)/dashboard/job-leads/actions";

interface JobLeadsClientProps {
  initialLeads: JobListing[];
  initialStats: JobLeadStats;
  sources: JobEmailSource[];
  initialPreferences: LeadPreferences | null;
}

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

function MatchBadge({ score, reason }: { score: number; reason: string | null }) {
  if (score >= 80) {
    return (
      <span
        className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400"
        title={reason ?? undefined}
      >
        {score}% High match
      </span>
    );
  }
  if (score >= 50) {
    return (
      <span
        className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
        title={reason ?? undefined}
      >
        {score}% Medium
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
      title={reason ?? undefined}
    >
      {score > 0 ? `${score}%` : "—"} Low match
    </span>
  );
}

function StatusBadge({
  status,
  autoApproved,
  autoApproveReason,
}: {
  status: LeadStatus;
  autoApproved?: boolean;
  autoApproveReason?: string | null;
}) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Pending
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <Check className="size-3" />
          Approved
        </span>
        {autoApproved && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            title={autoApproveReason ?? "Auto-approved based on learned preferences"}
          >
            <Zap className="size-2.5" />
            Auto
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <X className="size-3" />
      Rejected
    </span>
  );
}

function RemoteTypeBadge({ type }: { type: string }) {
  if (type === "remote") {
    return (
      <Badge variant="outline" className="border-green-300 text-green-700 text-[10px] px-1.5 py-0">
        Remote
      </Badge>
    );
  }
  if (type === "hybrid") {
    return (
      <Badge variant="outline" className="border-blue-300 text-blue-700 text-[10px] px-1.5 py-0">
        Hybrid
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
      Onsite
    </Badge>
  );
}

function approvalRate(approved: number, rejected: number): number | null {
  const total = approved + rejected;
  if (total < 5) return null;
  return Math.round((approved / total) * 100);
}

function sortedSources(sources: JobEmailSource[]): JobEmailSource[] {
  return [...sources].sort((a, b) => {
    const rateA = approvalRate(a.total_approved, a.total_rejected);
    const rateB = approvalRate(b.total_approved, b.total_rejected);
    // Sources with decisions come before those without
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
      <h2 className="mb-3 text-lg font-semibold">Learned Sources</h2>
      <div className="divide-y rounded-lg border">
        {sortedSources(sources).map((source) => {
          const rate = approvalRate(source.total_approved, source.total_rejected);
          const totalDecisions = source.total_approved + source.total_rejected;
          const isLowPerformance = rate !== null && rate < 50 && totalDecisions >= 10;
          const isEditing = editingId === source.id;
          const canEnableTrusted = rate !== null && rate >= 80 && totalDecisions >= 10;

          return (
            <div
              key={source.id}
              className="flex items-center justify-between px-4 py-3 gap-3"
            >
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
                        onClick={() => {
                          setEditingId(source.id);
                          setEditValue(source.display_name || source.sender_email);
                        }}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        title="Edit display name"
                      >
                        <Pencil className="size-3" />
                      </button>
                    </>
                  )}
                  {isLowPerformance && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                      <AlertTriangle className="size-3" />
                      Low approval rate
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{source.sender_email}</p>
                <p className="text-xs text-muted-foreground">
                  {source.total_extracted} extracted · {source.total_approved} approved ·{" "}
                  {source.total_rejected} rejected
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
                  title={
                    canEnableTrusted
                      ? "Enable trusted auto-approve for high-confidence leads"
                      : "Need ≥80% approval rate and 10+ decisions to enable trusted auto-approve"
                  }
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteSource(source.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PreferencesPanel({
  preferences,
  totalDecisions,
}: {
  preferences: LeadPreferences | null;
  totalDecisions: number;
}) {
  const router = useRouter();
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
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">My Preferences</h2>
        {!notEnoughData && (
          <Button
            variant={hasPreferences ? "outline" : "default"}
            size="sm"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Analyzing your {totalDecisions} decisions…
              </>
            ) : hasPreferences ? (
              "Re-analyze"
            ) : (
              "Analyze My Preferences"
            )}
          </Button>
        )}
      </div>

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
                    <span
                      key={s}
                      className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {preferences.negative_signals.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Negative signals</p>
                <div className="flex flex-wrap gap-1.5">
                  {preferences.negative_signals.map((s) => (
                    <span
                      key={s}
                      className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {preferences.preferred_companies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Preferred companies</p>
                <div className="flex flex-wrap gap-1.5">
                  {preferences.preferred_companies.map((c) => (
                    <span
                      key={c}
                      className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {preferences.preferred_locations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Preferred locations</p>
                <div className="flex flex-wrap gap-1.5">
                  {preferences.preferred_locations.map((l) => (
                    <span
                      key={l}
                      className="inline-flex rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Based on {preferences.decision_count} decisions
              {preferences.last_analyzed_at
                ? ` · last analyzed ${timeAgo(preferences.last_analyzed_at)}`
                : ""}
            </span>
            <span
              className={
                preferences.decision_count >= 10
                  ? "text-green-600 dark:text-green-400"
                  : "text-amber-600 dark:text-amber-400"
              }
            >
              {preferences.decision_count >= 10
                ? "Auto-approve enabled when source is trusted"
                : `${preferences.decision_count}/10 decisions for auto-approve`}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            You have {totalDecisions} decision{totalDecisions !== 1 ? "s" : ""}. Click &ldquo;Analyze My
            Preferences&rdquo; to extract your job preferences from your approve/reject history.
          </p>
          {totalDecisions < 10 && (
            <p className="text-xs text-muted-foreground">
              {totalDecisions}/10 decisions needed for auto-approve
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function JobLeadsClient({
  initialLeads,
  initialStats,
  sources,
  initialPreferences,
}: JobLeadsClientProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [stats, setStats] = useState(initialStats);
  const [filter, setFilter] = useState<"all" | LeadStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Client-side filter + search
  const filteredLeads = leads
    .filter((l) => {
      if (filter !== "all" && l.lead_status !== filter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          l.title.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q)
        );
      }
      return true;
    });

  // Sort: pending first, then approved, then rejected; within each group by created_at desc
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    const statusOrder = { pending: 0, approved: 1, rejected: 2 };
    const aOrder = statusOrder[(a.lead_status as keyof typeof statusOrder) ?? "approved"] ?? 1;
    const bOrder = statusOrder[(b.lead_status as keyof typeof statusOrder) ?? "approved"] ?? 1;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Select all (visible filtered leads)
  const allVisibleIds = sortedLeads.map((l) => l.id);
  const allSelected =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selectedIds.has(id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveJobLead(id);
      if (result.success) {
        toast.success("Lead approved");
        setLeads((prev) =>
          prev.map((l) =>
            l.id === id ? { ...l, lead_status: "approved" as const, is_saved: true } : l
          )
        );
        setStats((prev) => ({
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          approved: prev.approved + 1,
        }));
      } else {
        toast.error(result.error || "Failed to approve");
      }
    });
  }

  async function handleReject(id: string) {
    startTransition(async () => {
      const result = await rejectJobLead(id);
      if (result.success) {
        toast.success("Lead rejected");
        setLeads((prev) =>
          prev.map((l) =>
            l.id === id ? { ...l, lead_status: "rejected" as const } : l
          )
        );
        setStats((prev) => ({
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          rejected: prev.rejected + 1,
        }));
      } else {
        toast.error(result.error || "Failed to reject");
      }
    });
  }

  async function handleUndo(id: string) {
    startTransition(async () => {
      const result = await undoRejectJobLead(id);
      if (result.success) {
        toast.success("Lead moved back to pending");
        setLeads((prev) =>
          prev.map((l) =>
            l.id === id ? { ...l, lead_status: "pending" as const } : l
          )
        );
        setStats((prev) => ({
          ...prev,
          pending: prev.pending + 1,
          rejected: Math.max(0, prev.rejected - 1),
        }));
      } else {
        toast.error(result.error || "Failed to undo");
      }
    });
  }

  async function handleApply(lead: JobListing) {
    try {
      const res = await fetch("/api/jobs/start-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobListingId: lead.id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Application created for ${lead.company} — ${lead.title}`, {
          action: {
            label: "View Applications",
            onClick: () => {
              window.location.href = "/dashboard/applications";
            },
          },
        });
        setLeads((prev) =>
          prev.map((l) =>
            l.id === lead.id
              ? {
                  ...l,
                  lead_status: "approved" as const,
                  has_applied: true,
                  application_id: data.applicationId,
                }
              : l
          )
        );
      } else {
        toast.error(data.error || "Failed to create application");
      }
    } catch {
      toast.error("Failed to create application");
    }
  }

  async function handleBulkApprove() {
    const ids = Array.from(selectedIds);
    const result = await bulkApproveJobLeads(ids);
    if (result.success) {
      toast.success(`${ids.length} leads approved`);
      window.location.reload();
    } else {
      toast.error(result.error || "Bulk approve failed");
    }
  }

  async function handleBulkReject() {
    const ids = Array.from(selectedIds);
    const result = await bulkRejectJobLeads(ids);
    if (result.success) {
      toast.success(`${ids.length} leads rejected`);
      window.location.reload();
    } else {
      toast.error(result.error || "Bulk reject failed");
    }
  }

  async function handleToggleAutoExtract(sourceId: string, enabled: boolean) {
    const result = await toggleAutoExtract(sourceId, enabled);
    if (result.success) {
      toast.success(enabled ? "Auto-extract enabled" : "Auto-extract disabled");
      window.location.reload();
    } else {
      toast.error(result.error || "Failed to update");
    }
  }

  async function handleToggleTrusted(sourceId: string, enabled: boolean) {
    const result = await toggleTrustedSource(sourceId, enabled);
    if (result.success) {
      toast.success(enabled ? "Trusted auto-approve enabled" : "Trusted auto-approve disabled");
      window.location.reload();
    } else {
      toast.error(result.error || "Failed to update");
    }
  }

  async function handleDeleteSource(sourceId: string) {
    const result = await deleteJobEmailSource(sourceId);
    if (result.success) {
      toast.success("Source removed");
      window.location.reload();
    } else {
      toast.error(result.error || "Failed to delete");
    }
  }

  const FILTER_TABS: { value: "all" | LeadStatus; label: string; count: number }[] = [
    { value: "all", label: "All", count: stats.total },
    { value: "pending", label: "Pending", count: stats.pending },
    { value: "approved", label: "Approved", count: stats.approved },
    { value: "rejected", label: "Rejected", count: stats.rejected },
  ];

  const totalDecisions = stats.approved + stats.rejected;

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={filter === tab.value ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter(tab.value)}
            className="gap-1.5"
          >
            {tab.label}
            <Badge
              variant={filter === tab.value ? "secondary" : "outline"}
              className="text-[10px] px-1.5 py-0 h-4"
            >
              {tab.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Search */}
      <Input
        placeholder="Search by title or company..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-sm"
      />

      {/* Table */}
      {sortedLeads.length === 0 ? (
        leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <Target className="mb-3 size-10 text-muted-foreground/40" />
            <p className="mb-1 font-medium">No job leads yet</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Extract jobs from your emails or discover them in job search
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard/emails">Browse your emails</a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard/jobs">Discover jobs</a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No {filter !== "all" ? filter : ""} leads found
            </p>
          </div>
        )
      ) : (
        <div className="rounded-lg border">
          {/* Header row */}
          <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="rounded"
            />
            <span className="w-28">Status</span>
            <span className="flex-1">Job / Company</span>
            <span className="w-28 hidden sm:block">Location</span>
            <span className="w-24 hidden md:block">Score</span>
            <span className="w-6 hidden sm:block">Src</span>
            <span className="w-16 hidden md:block">Found</span>
            <span className="w-32 text-right">Actions</span>
          </div>

          {/* Lead rows */}
          <div className="divide-y">
            {sortedLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(lead.id)}
                  onChange={() => toggleSelect(lead.id)}
                  className="rounded shrink-0"
                />

                {/* Status */}
                <div className="w-28 shrink-0">
                  <StatusBadge
                    status={lead.lead_status as LeadStatus}
                    autoApproved={lead.auto_approved}
                    autoApproveReason={lead.auto_approve_reason}
                  />
                </div>

                {/* Title + Company */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {lead.url ? (
                      <a
                        href={lead.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sm hover:underline truncate"
                      >
                        {lead.title}
                      </a>
                    ) : (
                      <span className="font-medium text-sm truncate">{lead.title}</span>
                    )}
                    {lead.url && (
                      <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Building2 className="size-3 shrink-0" />
                    <span className="truncate">{lead.company}</span>
                  </div>
                </div>

                {/* Location */}
                <div className="w-28 hidden sm:flex flex-col gap-0.5">
                  {lead.location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{lead.location}</span>
                    </div>
                  )}
                  {lead.remote_type && lead.remote_type !== "unknown" && (
                    <RemoteTypeBadge type={lead.remote_type} />
                  )}
                </div>

                {/* Score */}
                <div className="w-24 hidden md:block">
                  <MatchBadge score={lead.match_score} reason={lead.match_reason} />
                </div>

                {/* Source indicator */}
                <div className="w-6 hidden sm:flex justify-center">
                  {lead.source_email_id ? (
                    <span title="From email">
                      <Mail className="size-3.5 text-muted-foreground" />
                    </span>
                  ) : (
                    <span title="From search">
                      <Search className="size-3.5 text-muted-foreground" />
                    </span>
                  )}
                </div>

                {/* Found time */}
                <div className="w-16 hidden md:block text-xs text-muted-foreground">
                  {timeAgo(lead.created_at)}
                </div>

                {/* Actions */}
                <div className="w-32 flex justify-end gap-1 shrink-0">
                  {lead.lead_status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800"
                        onClick={() => handleApprove(lead.id)}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Check className="size-3" />
                        )}
                        <span className="ml-1 text-[11px]">Approve</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-muted-foreground hover:text-destructive"
                        onClick={() => handleReject(lead.id)}
                        disabled={isPending}
                      >
                        <X className="size-3" />
                      </Button>
                    </>
                  )}
                  {lead.lead_status === "approved" && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => handleApply(lead)}
                      disabled={lead.has_applied}
                    >
                      {lead.has_applied ? "Applied" : "Apply →"}
                    </Button>
                  )}
                  {lead.lead_status === "rejected" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] text-muted-foreground"
                      onClick={() => handleUndo(lead.id)}
                      disabled={isPending}
                    >
                      <Undo2 className="size-3 mr-1" />
                      Undo
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border bg-background px-5 py-3 shadow-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            className="text-green-700 border-green-300"
            onClick={handleBulkApprove}
          >
            <Check className="size-3 mr-1" />
            Approve All
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30"
            onClick={handleBulkReject}
          >
            <X className="size-3 mr-1" />
            Reject All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

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
