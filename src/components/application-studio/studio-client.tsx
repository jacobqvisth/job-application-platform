'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ExternalLink,
  Star,
  Plus,
  X,
  Pencil,
  Check,
  Loader2,
  MapPin,
  Building2,
  Wifi,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Copy,
  FileText,
  RefreshCw,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import type {
  JobAnalysis,
  CompanyResearch,
  JobRequirement,
  ExtractedKeyword,
  PackageStatus,
  EvidenceMapping,
  ApplicationStrategy,
  EvidenceItem,
  RequirementMatch,
  Checkpoint2Edits,
  EvidenceOverride,
  ResumeContent,
  GeneratedCoverLetter,
  ScreeningQuestion,
} from '@/lib/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  url: string | null;
  remote_type: string | null;
  match_score: number | null;
  ats_type: string | null;
  required_skills: string[] | null;
}

interface InitialPackage {
  id: string;
  status: PackageStatus;
  job_analysis?: JobAnalysis | null;
  company_research?: CompanyResearch | null;
  evidence_mapping?: EvidenceMapping | null;
  strategy?: ApplicationStrategy | null;
  generated_resume?: ResumeContent | null;
  generated_cover_letter?: GeneratedCoverLetter | null;
  screening_questions?: ScreeningQuestion[] | null;
  ai_usage?: { steps: unknown[]; total_cost_estimate: number };
}

interface ApplicationStudioClientProps {
  initialJob: JobListing | null;
  initialPackage: InitialPackage | null;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { label: 'Analyze', statuses: ['analyzing', 'checkpoint_1'] },
  { label: 'Match', statuses: ['matching', 'checkpoint_2'] },
  { label: 'Generate', statuses: ['generating', 'checkpoint_3'] },
  { label: 'Review', statuses: ['completed'] },
];

function getStageIndex(status: PackageStatus | 'idle'): number {
  if (status === 'idle' || status === 'analyzing') return 0;
  if (status === 'checkpoint_1') return 0;
  if (status === 'matching' || status === 'checkpoint_2') return 1;
  if (status === 'generating' || status === 'checkpoint_3') return 2;
  if (status === 'completed') return 3;
  return 0;
}

function ProgressBar({ status }: { status: PackageStatus | 'idle' }) {
  const currentStage = getStageIndex(status);
  return (
    <div className="flex items-center gap-0 w-full max-w-lg mx-auto">
      {PIPELINE_STAGES.map((stage, i) => {
        const isDone = i < currentStage;
        const isActive = i === currentStage;
        return (
          <div key={stage.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all ${
                  isDone
                    ? 'bg-[#5347CE] border-[#5347CE] text-white'
                    : isActive
                    ? 'bg-white border-[#5347CE] text-[#5347CE]'
                    : 'bg-white border-zinc-200 text-zinc-400'
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`mt-1 text-xs font-medium ${
                  isDone || isActive ? 'text-[#5347CE]' : 'text-zinc-400'
                }`}
              >
                {stage.label}
              </span>
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <div
                className={`flex-1 h-0.5 mb-4 mx-1 transition-all ${
                  i < currentStage ? 'bg-[#5347CE]' : 'bg-zinc-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Job summary card (sticky left panel) ────────────────────────────────────

const LANGUAGE_FLAGS: Record<string, string> = {
  en: '🇬🇧',
  sv: '🇸🇪',
  no: '🇳🇴',
  de: '🇩🇪',
};

function JobSummaryCard({
  job,
  analysis,
  overallMatchScore,
}: {
  job: JobListing;
  analysis: JobAnalysis | null;
  overallMatchScore?: number | null;
}) {
  const displayScore = overallMatchScore ?? job.match_score;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-4">
      <div>
        <h2 className="font-semibold text-zinc-900 text-base leading-snug">{job.title}</h2>
        <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-1">
          <Building2 className="h-3.5 w-3.5" />
          {job.company}
        </p>
        {job.location && (
          <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {job.location}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {job.remote_type && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Wifi className="h-3 w-3" />
            {job.remote_type}
          </Badge>
        )}
        {job.ats_type && job.ats_type !== 'unknown' && (
          <Badge variant="outline" className="text-xs">
            {job.ats_type}
          </Badge>
        )}
        {analysis?.detected_language && (
          <Badge variant="outline" className="text-xs">
            {LANGUAGE_FLAGS[analysis.detected_language] || ''} {analysis.detected_language.toUpperCase()}
          </Badge>
        )}
        {displayScore != null && (
          <Badge
            className="text-xs"
            style={{
              backgroundColor:
                displayScore >= 70 ? '#dcfce7' : displayScore >= 40 ? '#fef9c3' : '#fee2e2',
              color:
                displayScore >= 70 ? '#166534' : displayScore >= 40 ? '#854d0e' : '#991b1b',
              border: 'none',
            }}
          >
            {displayScore}% match
          </Badge>
        )}
      </div>

      {analysis && (
        <div className="space-y-1 text-xs text-zinc-500">
          <div>
            <span className="font-medium text-zinc-700">Level:</span> {analysis.role_level}
          </div>
          <div>
            <span className="font-medium text-zinc-700">Family:</span> {analysis.role_family.replace(/_/g, ' ')}
          </div>
          <div>
            <span className="font-medium text-zinc-700">Type:</span> {analysis.employment_type}
          </div>
        </div>
      )}

      {job.url && (
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#5347CE] hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View original listing
        </a>
      )}
    </div>
  );
}

// ─── Requirements table ───────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, string> = {
  must_have: 'bg-white',
  nice_to_have: 'bg-zinc-50',
  inferred: 'border-dashed',
};

const CATEGORY_LABELS: Record<string, string> = {
  must_have: 'Must have',
  nice_to_have: 'Nice to have',
  inferred: 'Inferred',
};

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="focus:outline-none"
        >
          <Star
            className={`h-3.5 w-3.5 transition-colors ${
              n <= value ? 'fill-amber-400 text-amber-400' : 'text-zinc-200'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function RequirementsTable({
  requirements,
  onChange,
}: {
  requirements: JobRequirement[];
  onChange: (reqs: JobRequirement[]) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const startEdit = (i: number) => {
    setEditingIdx(i);
    setEditText(requirements[i].text);
  };

  const commitEdit = (i: number) => {
    if (!editText.trim()) return;
    const updated = requirements.map((r, idx) =>
      idx === i ? { ...r, text: editText.trim() } : r
    );
    onChange(updated);
    setEditingIdx(null);
  };

  const remove = (i: number) => {
    onChange(requirements.filter((_, idx) => idx !== i));
  };

  const setPriority = (i: number, p: number) => {
    onChange(requirements.map((r, idx) => (idx === i ? { ...r, priority: p } : r)));
  };

  const setCategory = (i: number, cat: JobRequirement['category']) => {
    onChange(requirements.map((r, idx) => (idx === i ? { ...r, category: cat } : r)));
  };

  const addNew = () => {
    onChange([...requirements, { text: 'New requirement', category: 'nice_to_have', priority: 3 }]);
    setEditingIdx(requirements.length);
    setEditText('New requirement');
  };

  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-[1fr_140px_100px_60px] gap-2 px-2 text-xs font-medium text-zinc-400 uppercase tracking-wide">
        <span>Requirement</span>
        <span>Category</span>
        <span>Priority</span>
        <span></span>
      </div>
      <div className="space-y-1">
        {requirements.map((req, i) => (
          <div
            key={i}
            className={`group grid grid-cols-[1fr_140px_100px_60px] gap-2 items-center px-2 py-1.5 rounded-lg border ${CATEGORY_STYLES[req.category]} hover:border-zinc-300 transition-colors`}
          >
            {editingIdx === i ? (
              <div className="col-span-4 sm:col-span-1 flex gap-1">
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(i);
                    if (e.key === 'Escape') setEditingIdx(null);
                  }}
                  className="h-7 text-sm"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => commitEdit(i)}>
                  <Check className="h-3.5 w-3.5 text-green-600" />
                </Button>
              </div>
            ) : (
              <span className="text-sm text-zinc-700 leading-snug">{req.text}</span>
            )}
            <select
              value={req.category}
              onChange={(e) => setCategory(i, e.target.value as JobRequirement['category'])}
              className="text-xs border border-zinc-200 rounded px-1.5 py-1 bg-white text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#5347CE]"
            >
              {(['must_have', 'nice_to_have', 'inferred'] as const).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
            <StarRating value={req.priority} onChange={(p) => setPriority(i, p)} />
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
              {editingIdx !== i && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(i)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-6 w-6 text-zinc-400 hover:text-red-500" onClick={() => remove(i)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="gap-1 text-xs mt-1" onClick={addNew}>
        <Plus className="h-3.5 w-3.5" />
        Add requirement
      </Button>
    </div>
  );
}

// ─── Keywords section ─────────────────────────────────────────────────────────

const KEYWORD_CATEGORY_STYLES: Record<string, string> = {
  skill: 'bg-blue-50 text-blue-700 border-blue-200',
  tool: 'bg-purple-50 text-purple-700 border-purple-200',
  trait: 'bg-green-50 text-green-700 border-green-200',
  domain: 'bg-amber-50 text-amber-700 border-amber-200',
};

function KeywordsSection({
  keywords,
  onChange,
}: {
  keywords: ExtractedKeyword[];
  onChange: (kws: ExtractedKeyword[]) => void;
}) {
  const [newKw, setNewKw] = useState('');

  const remove = (i: number) => onChange(keywords.filter((_, idx) => idx !== i));

  const add = () => {
    const trimmed = newKw.trim();
    if (!trimmed) return;
    onChange([...keywords, { keyword: trimmed, frequency: 1, category: 'skill' }]);
    setNewKw('');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {keywords.map((kw, i) => (
          <div
            key={i}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${KEYWORD_CATEGORY_STYLES[kw.category] || 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}
          >
            {kw.keyword}
            {kw.frequency > 1 && (
              <span className="opacity-60 font-normal">×{kw.frequency}</span>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add keyword…"
          value={newKw}
          onChange={(e) => setNewKw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className="h-8 text-sm max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={add} className="text-xs">
          Add
        </Button>
      </div>
      <div className="flex gap-3 text-xs text-zinc-400">
        {(['skill', 'tool', 'trait', 'domain'] as const).map((cat) => (
          <span key={cat} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${KEYWORD_CATEGORY_STYLES[cat]}`}>
            {cat}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Company research section ─────────────────────────────────────────────────

const SIZE_LABELS: Record<string, string> = {
  startup: 'Startup',
  scaleup: 'Scaleup',
  mid_market: 'Mid-market',
  enterprise: 'Enterprise',
  unknown: 'Unknown',
};

function CompanyResearchSection({
  research,
  onChange,
}: {
  research: CompanyResearch;
  onChange: (r: CompanyResearch) => void;
}) {
  const [newValue, setNewValue] = useState('');

  const removeValue = (i: number) => {
    onChange({ ...research, values: research.values.filter((_, idx) => idx !== i) });
  };

  const addValue = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    onChange({ ...research, values: [...research.values, trimmed] });
    setNewValue('');
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-zinc-900">{research.company_name}</h3>
          <p className="text-sm text-zinc-500">{research.industry}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs">
            {SIZE_LABELS[research.company_size] || research.company_size}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {research.growth_stage}
          </Badge>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Culture notes</label>
        <Textarea
          value={research.culture_notes}
          onChange={(e) => onChange({ ...research, culture_notes: e.target.value })}
          className="text-sm min-h-[80px] resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Company values</label>
        <div className="flex flex-wrap gap-2">
          {research.values.map((v, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200"
            >
              {v}
              <button
                type="button"
                onClick={() => removeValue(i)}
                className="opacity-50 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex gap-1.5">
            <Input
              placeholder="Add value…"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addValue();
                }
              }}
              className="h-7 text-xs w-32"
            />
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={addValue}>
              Add
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Why this role is interesting for you</label>
        <Textarea
          value={research.why_interesting}
          onChange={(e) => onChange({ ...research, why_interesting: e.target.value })}
          className="text-sm min-h-[60px] resize-none"
        />
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function AnalyzingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin text-[#5347CE]" />
        <span>Analyzing job description with AI…</span>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        {[1, 2, 3, 4, 5].map((n) => (
          <Skeleton key={n} className="h-10 w-full" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <Skeleton key={n} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Matching loading skeleton ────────────────────────────────────────────────

function MatchingSkeleton() {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-4 shadow-sm">
      <Loader2 className="h-8 w-8 animate-spin text-[#5347CE] mx-auto" />
      <div>
        <h3 className="font-semibold text-zinc-900">Mapping your experience to job requirements…</h3>
        <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
          Claude Sonnet is analyzing your profile, knowledge, and answer library…
        </p>
      </div>
      <div className="space-y-2 max-w-xs mx-auto">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6 mx-auto" />
        <Skeleton className="h-3 w-4/6 mx-auto" />
      </div>
    </div>
  );
}

// ─── Match score gauge ────────────────────────────────────────────────────────

function MatchScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626';
  const bg = score >= 70 ? '#dcfce7' : score >= 40 ? '#fef9c3' : '#fee2e2';
  return (
    <div
      className="w-20 h-20 rounded-full flex items-center justify-center border-4 font-bold text-xl"
      style={{ borderColor: color, backgroundColor: bg, color }}
    >
      {score}
    </div>
  );
}

// ─── Source badge ─────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<EvidenceItem['source'], string> = {
  work_history: '🏢 Work',
  knowledge_item: '🧠 Knowledge',
  answer_library: '📝 Answer',
  profile: '👤 Profile',
};

const SOURCE_STYLES: Record<EvidenceItem['source'], string> = {
  work_history: 'bg-blue-50 text-blue-700 border-blue-200',
  knowledge_item: 'bg-purple-50 text-purple-700 border-purple-200',
  answer_library: 'bg-green-50 text-green-700 border-green-200',
  profile: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

// ─── Evidence mapping section ─────────────────────────────────────────────────

function EvidenceMappingSection({
  matches,
  overrides,
  onOverrideChange,
}: {
  matches: RequirementMatch[];
  overrides: EvidenceOverride[];
  onOverrideChange: (overrides: EvidenceOverride[]) => void;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set([0]));

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const isSelected = (reqIdx: number, evIdx: number): boolean => {
    const override = overrides.find((o) => o.req_index === reqIdx && o.evidence_index === evIdx);
    if (override) return override.action === 'select';
    return matches[reqIdx].evidence[evIdx]?.selected ?? false;
  };

  const toggleEvidence = (reqIdx: number, evIdx: number) => {
    const currentlySelected = isSelected(reqIdx, evIdx);
    const originalSelected = matches[reqIdx].evidence[evIdx]?.selected ?? false;
    const newAction = currentlySelected ? 'deselect' : 'select';

    // If toggling back to original, remove the override
    if (newAction === (originalSelected ? 'select' : 'deselect')) {
      onOverrideChange(overrides.filter((o) => !(o.req_index === reqIdx && o.evidence_index === evIdx)));
    } else {
      // Upsert override
      const filtered = overrides.filter((o) => !(o.req_index === reqIdx && o.evidence_index === evIdx));
      onOverrideChange([...filtered, { req_index: reqIdx, evidence_index: evIdx, action: newAction }]);
    }
  };

  return (
    <div className="space-y-1">
      {matches.map((match, reqIdx) => {
        const bestScore = match.evidence.length > 0 ? Math.max(...match.evidence.map((e) => e.relevance_score)) : 0;
        const selectedCount = match.evidence.filter((_, evIdx) => isSelected(reqIdx, evIdx)).length;
        const isExpanded = expandedRows.has(reqIdx);

        return (
          <div key={reqIdx} className="border border-zinc-200 rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-zinc-50 transition-colors text-left"
              onClick={() => toggleRow(reqIdx)}
            >
              <div className="shrink-0">
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-zinc-400" />
                  : <ChevronRight className="h-4 w-4 text-zinc-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-zinc-800 leading-snug line-clamp-2">{match.requirement}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className="text-xs hidden sm:inline-flex"
                  style={{
                    borderColor: match.category === 'must_have' ? '#dc2626' : match.category === 'nice_to_have' ? '#d97706' : '#6b7280',
                    color: match.category === 'must_have' ? '#dc2626' : match.category === 'nice_to_have' ? '#d97706' : '#6b7280',
                  }}
                >
                  {CATEGORY_LABELS[match.category]}
                </Badge>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-3 w-3 ${n <= match.priority ? 'fill-amber-400 text-amber-400' : 'text-zinc-200'}`}
                    />
                  ))}
                </div>
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: bestScore >= 70 ? '#dcfce7' : bestScore >= 40 ? '#fef9c3' : '#fee2e2',
                    color: bestScore >= 70 ? '#166534' : bestScore >= 40 ? '#854d0e' : '#991b1b',
                  }}
                >
                  {bestScore}%
                </span>
                <span className="text-xs text-zinc-400">{selectedCount}/{match.evidence.length}</span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-zinc-100 bg-zinc-50 p-4 space-y-3">
                {match.evidence.length === 0 ? (
                  <p className="text-sm text-zinc-400 italic">No evidence found.</p>
                ) : (
                  match.evidence.map((ev, evIdx) => (
                    <div
                      key={evIdx}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        isSelected(reqIdx, evIdx)
                          ? 'bg-white border-[#5347CE]/30'
                          : 'bg-white border-zinc-200 opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected(reqIdx, evIdx)}
                        onChange={() => toggleEvidence(reqIdx, evIdx)}
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[#5347CE] focus:ring-[#5347CE] shrink-0 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border ${SOURCE_STYLES[ev.source]}`}>
                            {SOURCE_LABELS[ev.source]}
                          </span>
                          <span
                            className="text-xs font-medium px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: ev.relevance_score >= 70 ? '#dcfce7' : ev.relevance_score >= 40 ? '#fef9c3' : '#fee2e2',
                              color: ev.relevance_score >= 70 ? '#166534' : ev.relevance_score >= 40 ? '#854d0e' : '#991b1b',
                            }}
                          >
                            {ev.relevance_score}%
                          </span>
                        </div>
                        <p className="text-sm text-zinc-700 leading-relaxed">{ev.text}</p>
                      </div>
                    </div>
                  ))
                )}
                {match.gap_analysis && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">{match.gap_analysis}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Strategy card ────────────────────────────────────────────────────────────

function StrategyCard({
  strategy,
  onChange,
}: {
  strategy: ApplicationStrategy;
  onChange: (s: ApplicationStrategy) => void;
}) {
  const [newLeadWith, setNewLeadWith] = useState('');
  const [newDifferentiator, setNewDifferentiator] = useState('');

  const TONE_OPTIONS: ApplicationStrategy['tone'][] = ['formal', 'warm', 'energetic', 'executive'];
  const TEMPLATE_OPTIONS: { value: ApplicationStrategy['template_recommendation']; label: string }[] = [
    { value: 'clean', label: 'Clean' },
    { value: 'modern', label: 'Modern' },
    { value: 'compact', label: 'Compact' },
    { value: 'swedish', label: 'Swedish' },
  ];

  return (
    <div className="bg-white border-2 border-[#5347CE]/20 rounded-xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#5347CE]" />
        <h3 className="font-semibold text-zinc-900">Application Strategy</h3>
      </div>

      {/* Positioning */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Positioning</label>
        <Textarea
          value={strategy.positioning}
          onChange={(e) => onChange({ ...strategy, positioning: e.target.value })}
          className="text-sm min-h-[72px] resize-none"
          placeholder="Your 1-2 sentence positioning statement…"
        />
      </div>

      {/* Lead with */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Lead with</label>
        <div className="flex flex-wrap gap-2">
          {strategy.lead_with.map((item, i) => (
            <div key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#5347CE]/10 text-[#5347CE] border border-[#5347CE]/20">
              {item}
              <button
                type="button"
                onClick={() => onChange({ ...strategy, lead_with: strategy.lead_with.filter((_, idx) => idx !== i) })}
                className="opacity-50 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex gap-1.5">
            <Input
              placeholder="Add strength…"
              value={newLeadWith}
              onChange={(e) => setNewLeadWith(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLeadWith.trim()) {
                  e.preventDefault();
                  onChange({ ...strategy, lead_with: [...strategy.lead_with, newLeadWith.trim()] });
                  setNewLeadWith('');
                }
              }}
              className="h-7 text-xs w-36"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => {
                if (newLeadWith.trim()) {
                  onChange({ ...strategy, lead_with: [...strategy.lead_with, newLeadWith.trim()] });
                  setNewLeadWith('');
                }
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Gap framing */}
      {strategy.gap_framing.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Gap framing</label>
          <div className="space-y-3">
            {strategy.gap_framing.map((gf, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs font-medium text-zinc-600">{gf.gap}</p>
                <Textarea
                  value={gf.framing_strategy}
                  onChange={(e) => {
                    const updated = strategy.gap_framing.map((g, idx) =>
                      idx === i ? { ...g, framing_strategy: e.target.value } : g
                    );
                    onChange({ ...strategy, gap_framing: updated });
                  }}
                  className="text-sm min-h-[60px] resize-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tone */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Tone</label>
        <select
          value={strategy.tone}
          onChange={(e) => onChange({ ...strategy, tone: e.target.value as ApplicationStrategy['tone'] })}
          className="text-sm border border-zinc-200 rounded px-2.5 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#5347CE]"
        >
          {TONE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Template */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Resume template</label>
        <div className="flex gap-2 flex-wrap">
          {TEMPLATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...strategy, template_recommendation: opt.value })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                strategy.template_recommendation === opt.value
                  ? 'bg-[#5347CE] text-white border-[#5347CE]'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Narrative arc */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Narrative arc</label>
        <Textarea
          value={strategy.narrative_arc}
          onChange={(e) => onChange({ ...strategy, narrative_arc: e.target.value })}
          className="text-sm min-h-[80px] resize-none"
          placeholder="The story your application should tell…"
        />
      </div>

      {/* Differentiators */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Differentiators</label>
        <div className="flex flex-wrap gap-2">
          {strategy.differentiators.map((item, i) => (
            <div key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
              {item}
              <button
                type="button"
                onClick={() => onChange({ ...strategy, differentiators: strategy.differentiators.filter((_, idx) => idx !== i) })}
                className="opacity-50 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex gap-1.5">
            <Input
              placeholder="Add differentiator…"
              value={newDifferentiator}
              onChange={(e) => setNewDifferentiator(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newDifferentiator.trim()) {
                  e.preventDefault();
                  onChange({ ...strategy, differentiators: [...strategy.differentiators, newDifferentiator.trim()] });
                  setNewDifferentiator('');
                }
              }}
              className="h-7 text-xs w-40"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => {
                if (newDifferentiator.trim()) {
                  onChange({ ...strategy, differentiators: [...strategy.differentiators, newDifferentiator.trim()] });
                  setNewDifferentiator('');
                }
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ApplicationStudioClient({
  initialJob,
  initialPackage,
}: ApplicationStudioClientProps) {
  const router = useRouter();

  const [packageId, setPackageId] = useState<string | null>(initialPackage?.id ?? null);
  const [status, setStatus] = useState<PackageStatus | 'idle'>(
    initialPackage?.status ?? 'idle'
  );
  const [jobAnalysis, setJobAnalysis] = useState<JobAnalysis | null>(
    initialPackage?.job_analysis ?? null
  );
  const [companyResearch, setCompanyResearch] = useState<CompanyResearch | null>(
    initialPackage?.company_research ?? null
  );
  const [evidenceMapping, setEvidenceMapping] = useState<EvidenceMapping | null>(
    initialPackage?.evidence_mapping ?? null
  );
  const [strategy, setStrategy] = useState<ApplicationStrategy | null>(
    initialPackage?.strategy ?? null
  );
  const [aiCost, setAiCost] = useState<number>(
    initialPackage?.ai_usage?.total_cost_estimate ?? 0
  );

  // Local edit state for checkpoint 1
  const [requirements, setRequirements] = useState<JobRequirement[]>([]);
  const [keywords, setKeywords] = useState<ExtractedKeyword[]>([]);
  const [editedResearch, setEditedResearch] = useState<CompanyResearch | null>(null);

  // Local edit state for checkpoint 2
  const [evidenceOverrides, setEvidenceOverrides] = useState<EvidenceOverride[]>([]);
  const [editedStrategy, setEditedStrategy] = useState<ApplicationStrategy | null>(null);

  // AS3 state
  const [generatedResume, setGeneratedResume] = useState<ResumeContent | null>(
    initialPackage?.generated_resume ?? null
  );
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState<GeneratedCoverLetter | null>(
    initialPackage?.generated_cover_letter ?? null
  );
  const [screeningQuestions, setScreeningQuestions] = useState<ScreeningQuestion[]>(
    initialPackage?.screening_questions ?? []
  );
  const [editedCoverLetter, setEditedCoverLetter] = useState<string>(
    initialPackage?.generated_cover_letter?.text ?? ''
  );
  const [editedAnswers, setEditedAnswers] = useState<string[]>(
    initialPackage?.screening_questions?.map((q) => q.answer) ?? []
  );

  // UI state
  const [isContinuing, setIsContinuing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const job = initialJob;

  // Start analysis when job is loaded but no package yet
  const startAnalysis = useCallback(async () => {
    if (!job || status !== 'idle') return;
    setStatus('analyzing');
    try {
      const res = await fetch('/api/application-studio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_listing_id: job.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Analysis failed');
      }
      const data = await res.json();
      setPackageId(data.package_id);
      setJobAnalysis(data.job_analysis);
      setRequirements(data.job_analysis.requirements);
      setKeywords(data.job_analysis.keywords);
      setCompanyResearch(data.company_research);
      setEditedResearch(data.company_research);
      setAiCost(data.ai_usage.total_cost_estimate);
      setStatus('checkpoint_1');
    } catch (err) {
      toast.error((err as Error).message || 'Analysis failed');
      setStatus('idle');
    }
  }, [job, status]);

  // Initialize edit state when analysis loads from server
  const [initialized, setInitialized] = useState(false);
  if (!initialized && jobAnalysis && status === 'checkpoint_1') {
    setRequirements(jobAnalysis.requirements);
    setKeywords(jobAnalysis.keywords);
    setEditedResearch(companyResearch);
    setInitialized(true);
  }

  // Initialize checkpoint 2 edit state
  const [cp2Initialized, setCp2Initialized] = useState(false);
  if (!cp2Initialized && strategy && status === 'checkpoint_2') {
    setEditedStrategy(strategy);
    setCp2Initialized(true);
  }

  // Auto-start if no package yet
  if (status === 'idle' && job && !packageId) {
    startAnalysis();
  }

  // Trigger matching after checkpoint 1
  const triggerMatching = useCallback(async (pkgId: string) => {
    try {
      const res = await fetch('/api/application-studio/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: pkgId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Evidence matching failed');
      }
      const data = await res.json();
      setEvidenceMapping(data.evidence_mapping);
      setStrategy(data.strategy);
      setEditedStrategy(data.strategy);
      setAiCost(data.ai_usage.total_cost_estimate);
      setCp2Initialized(true);
      setStatus('checkpoint_2');
    } catch (err) {
      toast.error((err as Error).message || 'Evidence matching failed');
      // Stay on matching status — user can retry later
    }
  }, []);

  const handleContinue = async () => {
    if (!packageId) return;
    setIsContinuing(true);
    try {
      // Build edits object — only include changed fields
      const edits: Record<string, unknown> = {};
      if (JSON.stringify(requirements) !== JSON.stringify(jobAnalysis?.requirements)) {
        edits.edited_requirements = requirements;
      }
      if (editedResearch && JSON.stringify(editedResearch) !== JSON.stringify(companyResearch)) {
        edits.company_research_edits = editedResearch;
      }

      const res = await fetch('/api/application-studio/checkpoint-1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: packageId, edits }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save checkpoint');
      }
      setStatus('matching');
      // Auto-trigger evidence matching
      triggerMatching(packageId);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to continue');
    } finally {
      setIsContinuing(false);
    }
  };

  const handleCheckpoint2Continue = async () => {
    if (!packageId) return;
    setIsContinuing(true);
    try {
      const cp2Edits: Checkpoint2Edits = {};
      if (evidenceOverrides.length > 0) cp2Edits.evidence_overrides = evidenceOverrides;
      if (editedStrategy && JSON.stringify(editedStrategy) !== JSON.stringify(strategy)) {
        cp2Edits.strategy_overrides = {
          tone: editedStrategy.tone,
          lead_with: editedStrategy.lead_with,
          template_recommendation: editedStrategy.template_recommendation,
          positioning: editedStrategy.positioning,
          narrative_arc: editedStrategy.narrative_arc,
        };
      }

      const res = await fetch('/api/application-studio/checkpoint-2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: packageId, edits: cp2Edits }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save checkpoint 2');
      }
      setStatus('generating');
      // Auto-trigger generation
      triggerGeneration(packageId);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to continue');
    } finally {
      setIsContinuing(false);
    }
  };

  const triggerGeneration = useCallback(async (pkgId: string) => {
    try {
      const res = await fetch('/api/application-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: pkgId }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Generation failed');
      }
      const data = await res.json() as {
        generated_resume: ResumeContent;
        generated_cover_letter: GeneratedCoverLetter;
        screening_questions: ScreeningQuestion[];
        ai_usage: { total_cost_estimate: number };
      };
      setGeneratedResume(data.generated_resume);
      setGeneratedCoverLetter(data.generated_cover_letter);
      setScreeningQuestions(data.screening_questions);
      setEditedCoverLetter(data.generated_cover_letter.text);
      setEditedAnswers(data.screening_questions.map((q) => q.answer));
      setAiCost(data.ai_usage.total_cost_estimate);
      setStatus('checkpoint_3');
    } catch (err) {
      toast.error((err as Error).message || 'Generation failed');
      setStatus('checkpoint_2');
    }
  }, []);

  const handleRegenerate = async () => {
    if (!packageId) return;
    setGeneratedResume(null);
    setGeneratedCoverLetter(null);
    setScreeningQuestions([]);
    // Re-run checkpoint-2 to reset status to generating
    setIsContinuing(true);
    try {
      const res = await fetch('/api/application-studio/checkpoint-2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: packageId, edits: {} }),
      });
      if (!res.ok) throw new Error('Failed to reset');
      setStatus('generating');
      await triggerGeneration(packageId);
    } catch (err) {
      toast.error((err as Error).message || 'Regeneration failed');
      setStatus('checkpoint_3');
    } finally {
      setIsContinuing(false);
    }
  };

  const handleCheckpoint3Complete = async (saveResume: boolean) => {
    if (!packageId) return;
    setIsContinuing(true);
    try {
      const screeningEdits = screeningQuestions
        .map((q, i) => ({ question_index: i, answer: editedAnswers[i] ?? q.answer }))
        .filter((e, i) => e.answer !== screeningQuestions[i].answer);

      const res = await fetch('/api/application-studio/checkpoint-3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: packageId,
          save_resume: saveResume,
          edits: {
            cover_letter_edits:
              editedCoverLetter !== generatedCoverLetter?.text
                ? { text: editedCoverLetter }
                : undefined,
            screening_edits: screeningEdits.length > 0 ? screeningEdits : undefined,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Failed to complete');
      }
      toast.success('Application package complete!');
      setStatus('completed');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to complete');
    } finally {
      setIsContinuing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'));
  };

  const handleSaveAndExit = async () => {
    setIsSaving(true);
    setTimeout(() => {
      router.push('/dashboard/chat');
    }, 300);
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      {/* Header with progress bar */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">Application Studio</h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                {job ? `${job.title} · ${job.company}` : 'Loading…'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-500 text-xs"
              onClick={handleSaveAndExit}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save & come back later'}
            </Button>
          </div>
          <ProgressBar status={status} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">
        <div className="flex gap-6 items-start">
          {/* Left: sticky job card */}
          {job && (
            <div className="w-72 shrink-0 sticky top-[120px]">
              <JobSummaryCard
                job={job}
                analysis={jobAnalysis}
                overallMatchScore={evidenceMapping?.overall_match_score}
              />
            </div>
          )}

          {/* Right: scrollable content */}
          <div className="flex-1 min-w-0 space-y-6 pb-24">
            {(status === 'analyzing' || status === 'idle') && <AnalyzingSkeleton />}

            {status === 'checkpoint_1' && jobAnalysis && (
              <>
                {/* Requirements */}
                <section className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-3">
                  <div>
                    <h3 className="font-semibold text-zinc-900">Requirements</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Extracted from the job description. Edit priorities, categories, or add/remove as needed.
                    </p>
                  </div>
                  <RequirementsTable requirements={requirements} onChange={setRequirements} />
                </section>

                {/* Keywords */}
                <section className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-3">
                  <div>
                    <h3 className="font-semibold text-zinc-900">Keywords</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Key terms from the JD. Remove irrelevant ones or add any that were missed.
                    </p>
                  </div>
                  <KeywordsSection keywords={keywords} onChange={setKeywords} />
                </section>

                {/* Company Research */}
                {editedResearch && (
                  <section className="space-y-2">
                    <h3 className="font-semibold text-zinc-900 px-1">Company Research</h3>
                    <p className="text-xs text-zinc-400 px-1">
                      AI-inferred from the job description. Refine if anything looks off.
                    </p>
                    <CompanyResearchSection
                      research={editedResearch}
                      onChange={setEditedResearch}
                    />
                  </section>
                )}

                {/* AI cost info */}
                {aiCost > 0 && (
                  <div className="text-xs text-zinc-400 px-1">
                    Analysis (~${aiCost.toFixed(4)} estimated cost)
                  </div>
                )}
              </>
            )}

            {status === 'matching' && <MatchingSkeleton />}

            {status === 'checkpoint_2' && evidenceMapping && editedStrategy && (
              <>
                {/* Match score */}
                <section className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-6">
                    <MatchScoreGauge score={evidenceMapping.overall_match_score} />
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">Strongest areas</p>
                        <div className="flex flex-wrap gap-1.5">
                          {evidenceMapping.strongest_areas.map((area, i) => (
                            <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                      {evidenceMapping.gap_areas.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">Gap areas</p>
                          <div className="flex flex-wrap gap-1.5">
                            {evidenceMapping.gap_areas.map((area, i) => (
                              <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Evidence mapping table */}
                <section className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-zinc-900">Evidence Mapping</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Review evidence matched to each requirement. Toggle items to control what gets used in your application.
                    </p>
                  </div>
                  <EvidenceMappingSection
                    matches={evidenceMapping.matches}
                    overrides={evidenceOverrides}
                    onOverrideChange={setEvidenceOverrides}
                  />
                </section>

                {/* Strategy card */}
                <StrategyCard strategy={editedStrategy} onChange={setEditedStrategy} />

                {/* AI cost */}
                {aiCost > 0 && (
                  <div className="text-xs text-zinc-400 px-1">
                    Total AI cost so far: ~${aiCost.toFixed(4)}
                  </div>
                )}
              </>
            )}

            {status === 'generating' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center gap-4 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-[#5347CE]" />
                  <div>
                    <h3 className="font-semibold text-zinc-900">Generating your application package…</h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      Claude Opus is crafting your tailored resume, cover letter, and screening answers.
                      <br />This takes 30–60 seconds.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </div>
            )}

            {/* ── AS3: Checkpoint 3 ─────────────────────────────────────── */}
            {status === 'checkpoint_3' && generatedResume && generatedCoverLetter && (
              <>
                {/* Resume preview */}
                <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-zinc-100 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#5347CE]" />
                    <h3 className="font-semibold text-zinc-900">Tailored Resume</h3>
                    <span className="text-xs text-zinc-400 ml-auto">
                      {generatedResume.sections.filter((s) => s.visible).length} sections · {generatedResume.template} template
                    </span>
                  </div>
                  <div className="p-5 space-y-4 text-sm">
                    {generatedResume.sections
                      .filter((s) => s.visible)
                      .sort((a, b) => a.order - b.order)
                      .map((section) => (
                        <div key={section.id} className="space-y-1.5">
                          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-1">
                            {section.title}
                          </h4>
                          {section.type === 'summary' && (
                            <p className="text-xs text-zinc-700 leading-relaxed">
                              {(section.content as { text: string }).text}
                            </p>
                          )}
                          {section.type === 'experience' && (
                            <div className="space-y-3">
                              {(section.content as { items: { id: string; title: string; company: string; location: string; startDate: string; endDate: string | null; bullets: string[] }[] }).items.map((item) => (
                                <div key={item.id}>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-medium text-zinc-800">{item.title}</span>
                                    <span className="text-xs text-zinc-400">{item.startDate} – {item.endDate ?? 'Present'}</span>
                                  </div>
                                  <p className="text-xs text-zinc-500">{item.company}{item.location ? ` · ${item.location}` : ''}</p>
                                  <ul className="mt-1 space-y-0.5">
                                    {item.bullets.filter(Boolean).map((b, i) => (
                                      <li key={i} className="text-xs text-zinc-600 flex gap-1.5">
                                        <span className="text-zinc-400 shrink-0">•</span>
                                        <span>{b}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          )}
                          {section.type === 'skills' && (
                            <div className="space-y-1">
                              {(section.content as { categories: { id: string; name: string; skills: string[] }[] }).categories
                                .filter((cat) => cat.skills.length > 0)
                                .map((cat) => (
                                  <div key={cat.id} className="flex gap-2 text-xs">
                                    <span className="font-medium text-zinc-700 shrink-0">{cat.name}:</span>
                                    <span className="text-zinc-500">{cat.skills.join(', ')}</span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                  <div className="px-5 pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => handleCheckpoint3Complete(true)}
                      disabled={isContinuing}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Save to My Resumes
                    </Button>
                  </div>
                </div>

                {/* Cover letter */}
                <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-zinc-100 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-[#5347CE]" />
                    <h3 className="font-semibold text-zinc-900">
                      {generatedCoverLetter.language === 'sv' ? 'Personligt brev' : 'Cover Letter'}
                    </h3>
                    <span className="text-xs text-zinc-400 ml-auto">
                      {generatedCoverLetter.word_count} words · {generatedCoverLetter.tone}
                    </span>
                  </div>
                  <div className="p-5 space-y-3">
                    <Textarea
                      value={editedCoverLetter}
                      onChange={(e) => setEditedCoverLetter(e.target.value)}
                      className="min-h-[320px] text-sm font-mono leading-relaxed resize-y"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-400">
                        {editedCoverLetter.split(/\s+/).filter(Boolean).length} words
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1"
                        onClick={() => copyToClipboard(editedCoverLetter)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy to clipboard
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Screening questions */}
                {screeningQuestions.length > 0 && (
                  <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-zinc-100 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-[#5347CE]" />
                      <h3 className="font-semibold text-zinc-900">Screening Questions</h3>
                      <span className="text-xs text-zinc-400 ml-auto">{screeningQuestions.length} predicted</span>
                    </div>
                    <div className="p-5 space-y-5">
                      {screeningQuestions.map((q, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 text-xs font-medium text-zinc-400 mt-0.5 w-5">{i + 1}.</span>
                            <div className="flex-1 space-y-2">
                              <p className="text-sm font-medium text-zinc-800">{q.question}</p>
                              <div className="flex gap-1.5">
                                <Badge variant="secondary" className="text-xs">{q.category}</Badge>
                              </div>
                              <Textarea
                                value={editedAnswers[i] ?? q.answer}
                                onChange={(e) => {
                                  const next = [...editedAnswers];
                                  next[i] = e.target.value;
                                  setEditedAnswers(next);
                                }}
                                className="text-sm min-h-[100px] resize-y"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Completed ─────────────────────────────────────────────── */}
            {status === 'completed' && (
              <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-4 shadow-sm">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                <div>
                  <h3 className="font-semibold text-zinc-900 text-lg">Application package ready!</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Your tailored resume, cover letter, and screening answers are complete.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => router.push('/dashboard/resumes')}
                  >
                    <FileText className="h-4 w-4" />
                    View in My Resumes
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#5347CE] hover:bg-[#4338a8] text-white gap-1"
                    onClick={() => router.push('/dashboard/applications')}
                  >
                    <Plus className="h-4 w-4" />
                    Track Application
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-zinc-400"
                  onClick={() => router.push('/dashboard/job-leads')}
                >
                  Back to Job Leads
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom action bar — checkpoint 1 */}
      {status === 'checkpoint_1' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-6 py-3 z-10">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Review the analysis above, make any edits, then continue.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAndExit}
                disabled={isSaving || isContinuing}
              >
                Save & exit
              </Button>
              <Button
                size="sm"
                onClick={handleContinue}
                disabled={isContinuing}
                className="bg-[#5347CE] hover:bg-[#4338a8] text-white gap-2"
              >
                {isContinuing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Looks good — continue to evidence matching →'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom action bar — checkpoint 2 */}
      {status === 'checkpoint_2' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-6 py-3 z-10">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Review the evidence and strategy, then continue to generate your application.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAndExit}
                disabled={isSaving || isContinuing}
              >
                Save & exit
              </Button>
              <Button
                size="sm"
                onClick={handleCheckpoint2Continue}
                disabled={isContinuing}
                className="bg-[#5347CE] hover:bg-[#4338a8] text-white gap-2"
              >
                {isContinuing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Generate my application →'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom action bar — checkpoint 3 */}
      {status === 'checkpoint_3' && generatedResume && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-6 py-3 z-10">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-zinc-400 gap-1"
              onClick={handleRegenerate}
              disabled={isContinuing}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAndExit}
                disabled={isSaving || isContinuing}
              >
                Save & exit
              </Button>
              <Button
                size="sm"
                onClick={() => handleCheckpoint3Complete(false)}
                disabled={isContinuing}
                className="bg-[#5347CE] hover:bg-[#4338a8] text-white gap-2"
              >
                {isContinuing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Completing…
                  </>
                ) : (
                  'Approve & complete →'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
