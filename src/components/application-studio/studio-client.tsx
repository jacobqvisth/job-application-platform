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
} from 'lucide-react';
import type {
  JobAnalysis,
  CompanyResearch,
  JobRequirement,
  ExtractedKeyword,
  PackageStatus,
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
}: {
  job: JobListing;
  analysis: JobAnalysis | null;
}) {
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
        {job.match_score != null && (
          <Badge
            className="text-xs"
            style={{
              backgroundColor:
                job.match_score >= 70
                  ? '#dcfce7'
                  : job.match_score >= 40
                  ? '#fef9c3'
                  : '#fee2e2',
              color:
                job.match_score >= 70
                  ? '#166534'
                  : job.match_score >= 40
                  ? '#854d0e'
                  : '#991b1b',
              border: 'none',
            }}
          >
            {job.match_score}% match
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
    (initialPackage as { job_analysis?: JobAnalysis | null })?.job_analysis ?? null
  );
  const [companyResearch, setCompanyResearch] = useState<CompanyResearch | null>(
    (initialPackage as { company_research?: CompanyResearch | null })?.company_research ?? null
  );
  const [aiCost, setAiCost] = useState<number>(
    (initialPackage as { ai_usage?: { total_cost_estimate: number } })?.ai_usage?.total_cost_estimate ?? 0
  );

  // Local edit state for checkpoint 1
  const [requirements, setRequirements] = useState<JobRequirement[]>([]);
  const [keywords, setKeywords] = useState<ExtractedKeyword[]>([]);
  const [editedResearch, setEditedResearch] = useState<CompanyResearch | null>(null);

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

  // Auto-start if no package yet
  if (status === 'idle' && job && !packageId) {
    startAnalysis();
  }

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
      toast.success('Analysis saved! Evidence matching coming in Phase AS2.');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to continue');
    } finally {
      setIsContinuing(false);
    }
  };

  const handleSaveAndExit = async () => {
    setIsSaving(true);
    // Package is already saved in DB — just navigate away
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
              <JobSummaryCard job={job} analysis={jobAnalysis} />
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
                    Analysis used ~{((jobAnalysis as unknown as { _tokenCount?: number })._tokenCount || 0)} tokens
                    {' '}(~${aiCost.toFixed(4)} estimated cost)
                  </div>
                )}
              </>
            )}

            {status === 'matching' && (
              <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-3 shadow-sm">
                <div className="text-3xl">🔍</div>
                <h3 className="font-semibold text-zinc-900">Evidence Matching — Coming in Phase AS2</h3>
                <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                  The analysis is saved. Phase AS2 will map your work history and skills to these requirements using Claude Sonnet.
                </p>
                <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/chat')}>
                  Back to Chat
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
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
    </div>
  );
}
