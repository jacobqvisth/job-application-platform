"use client";

import { useState, useCallback, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  EyeOff,
  Plus,
  Trash2,
  X,
  Download,
  Wand2,
  Loader2,
  ChevronLeft,
  Save,
  Check,
} from "lucide-react";
import Link from "next/link";
import { ResumePreview } from "@/components/resumes/resume-preview";
import { updateResumeAction } from "../../actions/resume-actions";
import type {
  Resume,
  ResumeContent,
  ResumeSection,
  ResumeTemplate,
  ExperienceSectionContent,
  EducationSectionContent,
  SkillsSectionContent,
  SummarySectionContent,
  CertificationsSectionContent,
  LanguagesSectionContent,
  CustomSectionContent,
  ExperienceItem,
  EducationItem,
  SkillCategory,
  CertificationItem,
  LanguageItem,
  LanguageProficiency,
} from "@/lib/types/database";

interface ResumeEditorProps {
  resume: Resume;
}

type SaveState = "saved" | "saving" | "unsaved";

function newId() {
  return crypto.randomUUID();
}

async function downloadFile(
  url: string,
  resumeId: string,
  format: "pdf" | "docx"
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Download failed");
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `resume.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export function ResumeEditor({ resume }: ResumeEditorProps) {
  const [content, setContent] = useState<ResumeContent>(resume.content);
  const [name, setName] = useState(resume.name);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [showPreview, setShowPreview] = useState(true);
  const [tailorOpen, setTailorOpen] = useState(false);
  const [tailorJD, setTailorJD] = useState("");
  const [tailoring, setTailoring] = useState(false);
  const [tailorSuggestions, setTailorSuggestions] = useState<{
    summary?: { original: string; suggested: string; reason: string };
    experience_bullets?: {
      jobIndex: number;
      bulletIndex: number;
      original: string;
      suggested: string;
      reason: string;
    }[];
    keywords_to_add?: string[];
  } | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(resume.content.sections.map((s) => s.id))
  );
  const [skillInputs, setSkillInputs] = useState<Record<string, string>>({});

  const scheduleAutoSave = useCallback(
    (newContent: ResumeContent, newName: string) => {
      setSaveState("unsaved");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaveState("saving");
        startTransition(async () => {
          const result = await updateResumeAction(resume.id, {
            content: newContent,
            name: newName,
          });
          if (result.success) {
            setSaveState("saved");
          } else {
            setSaveState("unsaved");
            toast.error("Auto-save failed");
          }
        });
      }, 2000);
    },
    [resume.id]
  );

  function updateContent(newContent: ResumeContent) {
    setContent(newContent);
    scheduleAutoSave(newContent, name);
  }

  function updateName(newName: string) {
    setName(newName);
    scheduleAutoSave(content, newName);
  }

  function updateTemplate(template: ResumeTemplate) {
    updateContent({ ...content, template });
  }

  function updateSection(sectionId: string, updates: Partial<ResumeSection>) {
    updateContent({
      ...content,
      sections: content.sections.map((s) =>
        s.id === sectionId ? { ...s, ...updates } : s
      ),
    });
  }

  function toggleSection(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function addCustomSection() {
    const newSection: ResumeSection = {
      id: newId(),
      type: "custom",
      title: "Custom Section",
      visible: true,
      order: content.sections.length,
      content: { text: "" },
    };
    updateContent({
      ...content,
      sections: [...content.sections, newSection],
    });
  }

  function deleteSection(sectionId: string) {
    updateContent({
      ...content,
      sections: content.sections.filter((s) => s.id !== sectionId),
    });
  }

  // Section-specific helpers
  function getExperienceContent(section: ResumeSection): ExperienceSectionContent {
    return section.content as ExperienceSectionContent;
  }
  function getEducationContent(section: ResumeSection): EducationSectionContent {
    return section.content as EducationSectionContent;
  }
  function getSkillsContent(section: ResumeSection): SkillsSectionContent {
    return section.content as SkillsSectionContent;
  }

  // Tailor
  async function handleTailor() {
    if (!tailorJD.trim()) return;
    setTailoring(true);
    try {
      const res = await fetch("/api/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: resume.id,
          jobDescription: tailorJD,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTailorSuggestions(data.suggestions);
      } else {
        toast.error(data.error || "Tailoring failed");
      }
    } catch {
      toast.error("Failed to tailor resume");
    } finally {
      setTailoring(false);
    }
  }

  function applyTailorSuggestion(type: "summary", suggestion: string): void;
  function applyTailorSuggestion(
    type: "bullet",
    suggestion: string,
    jobIndex: number,
    bulletIndex: number
  ): void;
  function applyTailorSuggestion(
    type: string,
    suggestion: string,
    jobIndex?: number,
    bulletIndex?: number
  ) {
    if (type === "summary") {
      const summarySection = content.sections.find((s) => s.type === "summary");
      if (summarySection) {
        updateSection(summarySection.id, {
          content: { text: suggestion } as SummarySectionContent,
        });
      }
    } else if (
      type === "bullet" &&
      jobIndex !== undefined &&
      bulletIndex !== undefined
    ) {
      const experienceSection = content.sections.find(
        (s) => s.type === "experience"
      );
      if (experienceSection) {
        const expContent = getExperienceContent(experienceSection);
        const updatedItems = expContent.items.map((item, idx) =>
          idx === jobIndex
            ? {
                ...item,
                bullets: item.bullets.map((b, bIdx) =>
                  bIdx === bulletIndex ? suggestion : b
                ),
              }
            : item
        );
        updateSection(experienceSection.id, {
          content: { items: updatedItems },
        });
      }
    }
  }

  async function handleExport(format: "pdf" | "docx") {
    setExporting(format);
    try {
      // Save first
      await updateResumeAction(resume.id, { content, name });
      await downloadFile(`/api/resume/export/${format}`, resume.id, format);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(null);
    }
  }

  const sortedSections = [...content.sections].sort(
    (a, b) => a.order - b.order
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/resumes">
            <ChevronLeft className="size-4" />
            Resumes
          </Link>
        </Button>
        <Input
          value={name}
          onChange={(e) => updateName(e.target.value)}
          className="h-8 max-w-64 text-sm font-medium"
        />
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {saveState === "saving" && (
            <>
              <Loader2 className="size-3 animate-spin" />
              Saving...
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check className="size-3 text-green-500" />
              Saved
            </>
          )}
          {saveState === "unsaved" && (
            <>
              <Save className="size-3" />
              Unsaved changes
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={content.template}
            onValueChange={(v) => updateTemplate(v as ResumeTemplate)}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clean">Clean</SelectItem>
              <SelectItem value="modern">Modern</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTailorOpen(true)}
          >
            <Wand2 className="size-4" />
            Tailor
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={!!exporting}
          >
            {exporting === "pdf" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("docx")}
            disabled={!!exporting}
          >
            {exporting === "docx" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            DOCX
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sections editor */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sortedSections.map((section) => (
            <SectionEditor
              key={section.id}
              section={section}
              expanded={expandedSections.has(section.id)}
              onToggleExpand={() => toggleSection(section.id)}
              onUpdate={(updates) => updateSection(section.id, updates)}
              onDelete={
                section.type === "custom"
                  ? () => deleteSection(section.id)
                  : undefined
              }
              skillInputs={skillInputs}
              setSkillInputs={setSkillInputs}
            />
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={addCustomSection}
            className="w-full"
          >
            <Plus className="size-4" />
            Add Custom Section
          </Button>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="w-[45%] overflow-y-auto border-l bg-muted/30 p-4">
            <div className="sticky top-0">
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Preview
              </p>
              <ResumePreview content={content} name={name} scale={0.65} />
            </div>
          </div>
        )}
      </div>

      {/* Tailor Dialog */}
      <Dialog open={tailorOpen} onOpenChange={setTailorOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tailor for Job</DialogTitle>
          </DialogHeader>
          {!tailorSuggestions ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Job Description</Label>
                <Textarea
                  value={tailorJD}
                  onChange={(e) => setTailorJD(e.target.value)}
                  placeholder="Paste the job description here..."
                  rows={10}
                />
              </div>
              <Button
                onClick={handleTailor}
                disabled={!tailorJD.trim() || tailoring}
                className="w-full"
              >
                {tailoring ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Analyzing with Claude...
                  </>
                ) : (
                  <>
                    <Wand2 className="size-4" />
                    Generate Suggestions
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tailorSuggestions.summary && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Summary</h3>
                    <Button
                      size="sm"
                      onClick={() =>
                        applyTailorSuggestion(
                          "summary",
                          tailorSuggestions.summary!.suggested
                        )
                      }
                    >
                      Apply
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Current:</p>
                      <p className="text-muted-foreground line-through">
                        {tailorSuggestions.summary.original}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Suggested:</p>
                      <p className="text-green-700 dark:text-green-400">
                        {tailorSuggestions.summary.suggested}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      {tailorSuggestions.summary.reason}
                    </p>
                  </div>
                </div>
              )}

              {tailorSuggestions.experience_bullets?.map((suggestion, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">
                      Bullet · Job {suggestion.jobIndex + 1}
                    </h3>
                    <Button
                      size="sm"
                      onClick={() =>
                        applyTailorSuggestion(
                          "bullet",
                          suggestion.suggested,
                          suggestion.jobIndex,
                          suggestion.bulletIndex
                        )
                      }
                    >
                      Apply
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Current:</p>
                      <p className="text-muted-foreground line-through">
                        {suggestion.original}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Suggested:</p>
                      <p className="text-green-700 dark:text-green-400">
                        {suggestion.suggested}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      {suggestion.reason}
                    </p>
                  </div>
                </div>
              ))}

              {tailorSuggestions.keywords_to_add &&
                tailorSuggestions.keywords_to_add.length > 0 && (
                  <div className="rounded-lg border p-4 space-y-2">
                    <h3 className="font-semibold text-sm">
                      Keywords to Consider Adding
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {tailorSuggestions.keywords_to_add.map((kw) => (
                        <Badge key={kw} variant="secondary">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setTailorSuggestions(null);
                  setTailorJD("");
                }}
              >
                Start Over
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Section editor component
interface SectionEditorProps {
  section: ResumeSection;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<ResumeSection>) => void;
  onDelete?: () => void;
  skillInputs: Record<string, string>;
  setSkillInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

function SectionEditor({
  section,
  expanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  skillInputs,
  setSkillInputs,
}: SectionEditorProps) {
  function updateContent(content: ResumeSection["content"]) {
    onUpdate({ content });
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={onToggleExpand}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <span className="text-sm font-medium">{section.title}</span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onUpdate({ visible: !section.visible })}
          title={section.visible ? "Hide section" : "Show section"}
        >
          {section.visible ? (
            <Eye className="size-3.5 text-muted-foreground" />
          ) : (
            <EyeOff className="size-3.5 text-muted-foreground" />
          )}
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={onToggleExpand}
        >
          {expanded ? "▲" : "▼"}
        </Button>
      </div>

      {/* Content */}
      {expanded && (
        <div className="border-t px-3 pb-3 pt-2">
          {section.type === "custom" && (
            <Input
              value={section.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Section title"
              className="mb-2 text-sm font-medium"
            />
          )}
          <SectionContentEditor
            section={section}
            onUpdateContent={updateContent}
            skillInputs={skillInputs}
            setSkillInputs={setSkillInputs}
          />
        </div>
      )}
    </div>
  );
}

interface SectionContentEditorProps {
  section: ResumeSection;
  onUpdateContent: (content: ResumeSection["content"]) => void;
  skillInputs: Record<string, string>;
  setSkillInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

function SectionContentEditor({
  section,
  onUpdateContent,
  skillInputs,
  setSkillInputs,
}: SectionContentEditorProps) {
  switch (section.type) {
    case "summary": {
      const c = section.content as SummarySectionContent;
      return (
        <Textarea
          value={c.text}
          onChange={(e) => onUpdateContent({ text: e.target.value })}
          placeholder="Professional summary..."
          rows={4}
          className="text-sm"
        />
      );
    }
    case "experience": {
      const c = section.content as ExperienceSectionContent;
      return (
        <ExperienceEditor
          items={c.items}
          onChange={(items) => onUpdateContent({ items })}
        />
      );
    }
    case "education": {
      const c = section.content as EducationSectionContent;
      return (
        <EducationEditor
          items={c.items}
          onChange={(items) => onUpdateContent({ items })}
        />
      );
    }
    case "skills": {
      const c = section.content as SkillsSectionContent;
      return (
        <SkillsEditor
          categories={c.categories}
          onChange={(categories) => onUpdateContent({ categories })}
          skillInputs={skillInputs}
          setSkillInputs={setSkillInputs}
        />
      );
    }
    case "certifications": {
      const c = section.content as CertificationsSectionContent;
      return (
        <CertificationsEditor
          items={c.items}
          onChange={(items) => onUpdateContent({ items })}
        />
      );
    }
    case "languages": {
      const c = section.content as LanguagesSectionContent;
      return (
        <LanguagesEditor
          items={c.items}
          onChange={(items) => onUpdateContent({ items })}
        />
      );
    }
    case "custom": {
      const c = section.content as CustomSectionContent;
      return (
        <Textarea
          value={c.text}
          onChange={(e) => onUpdateContent({ text: e.target.value })}
          placeholder="Section content..."
          rows={4}
          className="text-sm"
        />
      );
    }
    default:
      return null;
  }
}

function ExperienceEditor({
  items,
  onChange,
}: {
  items: ExperienceItem[];
  onChange: (items: ExperienceItem[]) => void;
}) {
  function addJob() {
    onChange([
      ...items,
      {
        id: newId(),
        company: "",
        title: "",
        location: "",
        startDate: "",
        endDate: null,
        bullets: [""],
      },
    ]);
  }

  function update(id: string, field: keyof ExperienceItem, value: unknown) {
    onChange(items.map((j) => (j.id === id ? { ...j, [field]: value } : j)));
  }

  function remove(id: string) {
    onChange(items.filter((j) => j.id !== id));
  }

  function addBullet(id: string) {
    onChange(
      items.map((j) =>
        j.id === id ? { ...j, bullets: [...j.bullets, ""] } : j
      )
    );
  }

  function updateBullet(id: string, idx: number, value: string) {
    onChange(
      items.map((j) =>
        j.id === id
          ? {
              ...j,
              bullets: j.bullets.map((b, i) => (i === idx ? value : b)),
            }
          : j
      )
    );
  }

  function removeBullet(id: string, idx: number) {
    onChange(
      items.map((j) =>
        j.id === id
          ? { ...j, bullets: j.bullets.filter((_, i) => i !== idx) }
          : j
      )
    );
  }

  return (
    <div className="space-y-3">
      {items.map((job) => (
        <div key={job.id} className="space-y-2 rounded border p-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => remove(job.id)}
              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Company</Label>
              <Input
                value={job.company}
                onChange={(e) => update(job.id, "company", e.target.value)}
                placeholder="Company"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input
                value={job.title}
                onChange={(e) => update(job.id, "title", e.target.value)}
                placeholder="Title"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Location</Label>
              <Input
                value={job.location}
                onChange={(e) => update(job.id, "location", e.target.value)}
                placeholder="City, State"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="space-y-1">
                <Label className="text-xs">Start</Label>
                <Input
                  value={job.startDate}
                  onChange={(e) => update(job.id, "startDate", e.target.value)}
                  placeholder="2022-01"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End</Label>
                <Input
                  value={job.endDate ?? ""}
                  onChange={(e) =>
                    update(job.id, "endDate", e.target.value || null)
                  }
                  placeholder="Present"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bullets</Label>
            {job.bullets.map((bullet, idx) => (
              <div key={idx} className="flex gap-1">
                <Input
                  value={bullet}
                  onChange={(e) => updateBullet(job.id, idx, e.target.value)}
                  placeholder="Achievement..."
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => removeBullet(job.id, idx)}
                  disabled={job.bullets.length === 1}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => addBullet(job.id)}
            >
              <Plus className="size-3" />
              Add bullet
            </Button>
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={addJob}
        className="w-full text-xs"
      >
        <Plus className="size-3" />
        Add Position
      </Button>
    </div>
  );
}

function EducationEditor({
  items,
  onChange,
}: {
  items: EducationItem[];
  onChange: (items: EducationItem[]) => void;
}) {
  function add() {
    onChange([
      ...items,
      { id: newId(), institution: "", degree: "", field: "", startDate: "", endDate: null },
    ]);
  }

  function update(id: string, field: keyof EducationItem, value: unknown) {
    onChange(items.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  }

  function remove(id: string) {
    onChange(items.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-3">
      {items.map((edu) => (
        <div key={edu.id} className="space-y-2 rounded border p-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => remove(edu.id)}
              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Institution</Label>
              <Input
                value={edu.institution}
                onChange={(e) => update(edu.id, "institution", e.target.value)}
                placeholder="University"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Degree</Label>
              <Input
                value={edu.degree}
                onChange={(e) => update(edu.id, "degree", e.target.value)}
                placeholder="B.S."
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Field</Label>
              <Input
                value={edu.field}
                onChange={(e) => update(edu.id, "field", e.target.value)}
                placeholder="Computer Science"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Start</Label>
              <Input
                value={edu.startDate}
                onChange={(e) => update(edu.id, "startDate", e.target.value)}
                placeholder="2018-09"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End</Label>
              <Input
                value={edu.endDate ?? ""}
                onChange={(e) =>
                  update(edu.id, "endDate", e.target.value || null)
                }
                placeholder="2022-05"
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={add}
        className="w-full text-xs"
      >
        <Plus className="size-3" />
        Add Education
      </Button>
    </div>
  );
}

function SkillsEditor({
  categories,
  onChange,
  skillInputs,
  setSkillInputs,
}: {
  categories: SkillCategory[];
  onChange: (categories: SkillCategory[]) => void;
  skillInputs: Record<string, string>;
  setSkillInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  function addCategory() {
    onChange([...categories, { id: newId(), name: "", skills: [] }]);
  }

  function updateName(id: string, name: string) {
    onChange(categories.map((c) => (c.id === id ? { ...c, name } : c)));
  }

  function removeCategory(id: string) {
    onChange(categories.filter((c) => c.id !== id));
  }

  function addSkill(categoryId: string) {
    const input = skillInputs[categoryId]?.trim();
    if (!input) return;
    onChange(
      categories.map((c) =>
        c.id === categoryId && !c.skills.includes(input)
          ? { ...c, skills: [...c.skills, input] }
          : c
      )
    );
    setSkillInputs((prev) => ({ ...prev, [categoryId]: "" }));
  }

  function removeSkill(categoryId: string, skill: string) {
    onChange(
      categories.map((c) =>
        c.id === categoryId
          ? { ...c, skills: c.skills.filter((s) => s !== skill) }
          : c
      )
    );
  }

  return (
    <div className="space-y-3">
      {categories.map((cat) => (
        <div key={cat.id} className="rounded border p-3 space-y-2">
          <div className="flex gap-2">
            <Input
              value={cat.name}
              onChange={(e) => updateName(cat.id, e.target.value)}
              placeholder="Category name"
              className="h-7 text-xs flex-1"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => removeCategory(cat.id)}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {cat.skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="gap-1 text-xs">
                {skill}
                <button
                  onClick={() => removeSkill(cat.id, skill)}
                  className="hover:text-destructive"
                >
                  <X className="size-2.5" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-1">
            <Input
              value={skillInputs[cat.id] ?? ""}
              onChange={(e) =>
                setSkillInputs((prev) => ({
                  ...prev,
                  [cat.id]: e.target.value,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill(cat.id);
                }
              }}
              placeholder="Add skill..."
              className="h-7 text-xs flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => addSkill(cat.id)}
            >
              Add
            </Button>
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={addCategory}
        className="w-full text-xs"
      >
        <Plus className="size-3" />
        Add Category
      </Button>
    </div>
  );
}

function CertificationsEditor({
  items,
  onChange,
}: {
  items: CertificationItem[];
  onChange: (items: CertificationItem[]) => void;
}) {
  function add() {
    onChange([...items, { id: newId(), name: "", issuer: "", date: "" }]);
  }

  function update(
    id: string,
    field: keyof CertificationItem,
    value: string
  ) {
    onChange(items.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  function remove(id: string) {
    onChange(items.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-2">
      {items.map((cert) => (
        <div key={cert.id} className="grid grid-cols-2 gap-2 rounded border p-2">
          <div className="col-span-2 flex gap-1">
            <Input
              value={cert.name}
              onChange={(e) => update(cert.id, "name", e.target.value)}
              placeholder="Certification name"
              className="h-7 text-xs"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => remove(cert.id)}
            >
              <X className="size-3" />
            </Button>
          </div>
          <Input
            value={cert.issuer}
            onChange={(e) => update(cert.id, "issuer", e.target.value)}
            placeholder="Issuer"
            className="h-7 text-xs"
          />
          <Input
            value={cert.date}
            onChange={(e) => update(cert.id, "date", e.target.value)}
            placeholder="YYYY-MM"
            className="h-7 text-xs"
          />
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add} className="w-full text-xs">
        <Plus className="size-3" />
        Add Certification
      </Button>
    </div>
  );
}

function LanguagesEditor({
  items,
  onChange,
}: {
  items: LanguageItem[];
  onChange: (items: LanguageItem[]) => void;
}) {
  function add() {
    onChange([
      ...items,
      { id: newId(), language: "", proficiency: "intermediate" },
    ]);
  }

  function update(id: string, field: keyof LanguageItem, value: string) {
    onChange(items.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }

  function remove(id: string) {
    onChange(items.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-2">
      {items.map((lang) => (
        <div key={lang.id} className="flex gap-2">
          <Input
            value={lang.language}
            onChange={(e) => update(lang.id, "language", e.target.value)}
            placeholder="Language"
            className="h-8 text-xs flex-1"
          />
          <Select
            value={lang.proficiency}
            onValueChange={(v) =>
              update(lang.id, "proficiency", v as LanguageProficiency)
            }
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="native">Native</SelectItem>
              <SelectItem value="fluent">Fluent</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={() => remove(lang.id)}
          >
            <X className="size-3" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add} className="w-full text-xs">
        <Plus className="size-3" />
        Add Language
      </Button>
    </div>
  );
}
