"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, GraduationCap, Star, Globe } from "lucide-react";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
import type { ParsedLinkedInProfile } from "@/lib/linkedin/types";
import type {
  ExperienceItem,
  EducationItem,
  SkillCategory,
  CertificationItem,
  LanguageItem,
  LanguageProficiency,
  UserProfileData,
} from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Helper: convert LinkedIn proficiency string → LanguageProficiency enum
// ---------------------------------------------------------------------------
function toLanguageProficiency(s: string): LanguageProficiency {
  if (s === "native") return "native";
  if (s === "fluent") return "fluent";
  if (s === "advanced") return "advanced";
  if (s === "basic") return "basic";
  return "intermediate";
}

// ---------------------------------------------------------------------------
// Helper: simple soft-skill detection
// ---------------------------------------------------------------------------
const SOFT_KEYWORDS = new Set([
  "communication", "leadership", "management", "teamwork", "collaboration",
  "problem solving", "critical thinking", "adaptability", "time management",
  "creativity", "presentation", "negotiation", "mentoring", "coaching",
  "interpersonal", "multitasking", "organization", "organisation", "analytical",
  "strategic", "planning", "conflict resolution", "public speaking",
  "emotional intelligence", "empathy", "networking", "persuasion",
]);

function categorizeSkill(skill: string): "technical" | "soft" {
  const lower = skill.toLowerCase();
  for (const kw of SOFT_KEYWORDS) {
    if (lower.includes(kw)) return "soft";
  }
  return "technical";
}

// ---------------------------------------------------------------------------
// Helper: check if two companies are "the same"
// ---------------------------------------------------------------------------
function companiesMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

// ---------------------------------------------------------------------------
// Converters: LinkedIn → Profile types
// ---------------------------------------------------------------------------
function linkedInExpToItem(
  exp: ParsedLinkedInProfile["experience"][number]
): ExperienceItem {
  const bullets = exp.description
    .split("\n")
    .map((l) => l.replace(/^[-•·*]\s*/, "").trim())
    .filter((l) => l.length > 0);

  return {
    id: crypto.randomUUID(),
    company: exp.company,
    title: exp.title,
    location: exp.location,
    startDate: exp.startDate,
    endDate: exp.endDate,
    bullets: bullets.length > 0 ? bullets : [""],
  };
}

function linkedInEduToItem(
  edu: ParsedLinkedInProfile["education"][number]
): EducationItem {
  return {
    id: crypto.randomUUID(),
    institution: edu.institution,
    degree: edu.degree,
    field: edu.field,
    startDate: edu.startDate,
    endDate: edu.endDate,
    notes: edu.description || undefined,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 font-medium text-sm mb-3">
      {icon}
      {children}
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  children,
  badge,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition-colors">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-primary flex-shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {children}
          {badge}
        </div>
      </div>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export interface ImportedProfileData {
  summary: string;
  work_history: ExperienceItem[];
  education: EducationItem[];
  skills: SkillCategory[];
  certifications: CertificationItem[];
  languages: LanguageItem[];
}

interface LinkedInImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedInProfile: ParsedLinkedInProfile;
  currentProfile: UserProfileData | null;
  onImport: (data: ImportedProfileData) => void;
}

export function LinkedInImportDialog({
  open,
  onOpenChange,
  linkedInProfile,
  currentProfile,
  onImport,
}: LinkedInImportDialogProps) {
  // ---------- Summary ----------
  const [summaryChoice, setSummaryChoice] = useState<
    "current" | "linkedin" | "merge"
  >(currentProfile?.summary ? "current" : "linkedin");

  // ---------- Work history ----------
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(
    new Set(linkedInProfile.experience.map((_, i) => i))
  );

  // ---------- Education ----------
  const [selectedEdus, setSelectedEdus] = useState<Set<number>>(
    new Set(linkedInProfile.education.map((_, i) => i))
  );

  // ---------- Skills ----------
  const allExistingSkills = new Set(
    (currentProfile?.skills ?? [])
      .flatMap((c) => c.skills)
      .map((s) => s.toLowerCase())
  );
  const newLinkedInSkills = linkedInProfile.skills.filter(
    (s) => !allExistingSkills.has(s.toLowerCase())
  );
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(
    new Set(newLinkedInSkills)
  );

  // ---------- Certifications ----------
  const existingCertNames = new Set(
    (currentProfile?.certifications ?? []).map((c) => c.name.toLowerCase())
  );
  const newCerts = linkedInProfile.certifications.filter(
    (c) => !existingCertNames.has(c.name.toLowerCase())
  );
  const [selectedCerts, setSelectedCerts] = useState<Set<number>>(
    new Set(newCerts.map((_, i) => i))
  );

  // ---------- Languages ----------
  const existingLangNames = new Set(
    (currentProfile?.languages ?? []).map((l) => l.language.toLowerCase())
  );
  const newLangs = linkedInProfile.languages.filter(
    (l) => !existingLangNames.has(l.language.toLowerCase())
  );
  const [selectedLangs, setSelectedLangs] = useState<Set<number>>(
    new Set(newLangs.map((_, i) => i))
  );

  // ---------- Toggle helpers ----------
  function toggleJob(i: number, v: boolean) {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (v) { next.add(i); } else { next.delete(i); }
      return next;
    });
  }
  function toggleEdu(i: number, v: boolean) {
    setSelectedEdus((prev) => {
      const next = new Set(prev);
      if (v) { next.add(i); } else { next.delete(i); }
      return next;
    });
  }
  function toggleSkill(s: string, v: boolean) {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (v) { next.add(s); } else { next.delete(s); }
      return next;
    });
  }
  function toggleCert(i: number, v: boolean) {
    setSelectedCerts((prev) => {
      const next = new Set(prev);
      if (v) { next.add(i); } else { next.delete(i); }
      return next;
    });
  }
  function toggleLang(i: number, v: boolean) {
    setSelectedLangs((prev) => {
      const next = new Set(prev);
      if (v) { next.add(i); } else { next.delete(i); }
      return next;
    });
  }

  // ---------- Import ----------
  function handleImport() {
    // Summary
    let newSummary = currentProfile?.summary ?? "";
    if (summaryChoice === "linkedin") {
      newSummary = linkedInProfile.summary;
    } else if (summaryChoice === "merge") {
      newSummary = [currentProfile?.summary, linkedInProfile.summary]
        .filter(Boolean)
        .join("\n\n");
    }

    // Work history: start with existing, then add/update selected LinkedIn entries
    const existingJobs = currentProfile?.work_history ?? [];
    const newJobs = [...existingJobs];

    for (const [idx, exp] of linkedInProfile.experience.entries()) {
      if (!selectedJobs.has(idx)) continue;
      const converted = linkedInExpToItem(exp);
      const existingIdx = existingJobs.findIndex((j) =>
        companiesMatch(j.company, exp.company)
      );
      if (existingIdx >= 0) {
        newJobs[existingIdx] = { ...converted, id: existingJobs[existingIdx].id };
      } else {
        newJobs.push(converted);
      }
    }

    // Education
    const existingEdus = currentProfile?.education ?? [];
    const newEdus = [...existingEdus];

    for (const [idx, edu] of linkedInProfile.education.entries()) {
      if (!selectedEdus.has(idx)) continue;
      const converted = linkedInEduToItem(edu);
      const existingIdx = existingEdus.findIndex(
        (e) =>
          e.institution.toLowerCase() === edu.institution.toLowerCase()
      );
      if (existingIdx >= 0) {
        newEdus[existingIdx] = { ...converted, id: existingEdus[existingIdx].id };
      } else {
        newEdus.push(converted);
      }
    }

    // Skills: merge selected new skills into existing categories
    const existingCategories: SkillCategory[] =
      currentProfile?.skills && currentProfile.skills.length > 0
        ? currentProfile.skills
        : [
            { id: crypto.randomUUID(), name: "Technical Skills", skills: [] },
            { id: crypto.randomUUID(), name: "Soft Skills", skills: [] },
          ];

    const newCategories = existingCategories.map((c) => ({ ...c, skills: [...c.skills] }));

    for (const skill of selectedSkills) {
      const category = categorizeSkill(skill);
      const catName = category === "technical" ? "Technical Skills" : "Soft Skills";
      let catIdx = newCategories.findIndex((c) => c.name === catName);
      if (catIdx < 0) {
        newCategories.push({ id: crypto.randomUUID(), name: catName, skills: [] });
        catIdx = newCategories.length - 1;
      }
      if (!newCategories[catIdx].skills.map(s => s.toLowerCase()).includes(skill.toLowerCase())) {
        newCategories[catIdx].skills.push(skill);
      }
    }

    // Certifications
    const existingCerts = currentProfile?.certifications ?? [];
    const mergedCerts = [...existingCerts];
    newCerts.forEach((cert, i) => {
      if (selectedCerts.has(i)) {
        mergedCerts.push({
          id: crypto.randomUUID(),
          name: cert.name,
          issuer: cert.issuer,
          date: cert.date,
        });
      }
    });

    // Languages
    const existingLangs = currentProfile?.languages ?? [];
    const mergedLangs = [...existingLangs];
    newLangs.forEach((lang, i) => {
      if (selectedLangs.has(i)) {
        mergedLangs.push({
          id: crypto.randomUUID(),
          language: lang.language,
          proficiency: toLanguageProficiency(lang.proficiency),
        });
      }
    });

    onImport({
      summary: newSummary,
      work_history: newJobs,
      education: newEdus,
      skills: newCategories,
      certifications: mergedCerts,
      languages: mergedLangs,
    });

    onOpenChange(false);
  }

  const hasSummaryToImport =
    linkedInProfile.summary && linkedInProfile.summary.length > 0;
  const hasExperience = linkedInProfile.experience.length > 0;
  const hasEducation = linkedInProfile.education.length > 0;
  const hasNewSkills = newLinkedInSkills.length > 0;
  const hasNewCerts = newCerts.length > 0;
  const hasNewLangs = newLangs.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <LinkedInIcon className="size-4 text-[#0A66C2]" />
            Import from LinkedIn
          </DialogTitle>
          {linkedInProfile.header.name && (
            <p className="text-sm text-muted-foreground">
              Found profile:{" "}
              <span className="font-medium">
                {linkedInProfile.header.name}
              </span>
              {linkedInProfile.header.headline
                ? ` — ${linkedInProfile.header.headline}`
                : ""}
            </p>
          )}
        </DialogHeader>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 space-y-5 pr-1">

          {/* Summary */}
          {hasSummaryToImport && (
            <section>
              <SectionTitle icon={<Star className="size-3.5 text-muted-foreground" />}>
                Professional Summary
              </SectionTitle>
              <div className="space-y-2 text-sm">
                {currentProfile?.summary && (
                  <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
                    <input
                      type="radio"
                      name="summary"
                      className="mt-0.5 accent-primary"
                      checked={summaryChoice === "current"}
                      onChange={() => setSummaryChoice("current")}
                    />
                    <div>
                      <p className="font-medium text-xs text-muted-foreground mb-1">
                        Keep current
                      </p>
                      <p className="line-clamp-2 text-xs">
                        {currentProfile.summary}
                      </p>
                    </div>
                  </label>
                )}
                <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
                  <input
                    type="radio"
                    name="summary"
                    className="mt-0.5 accent-primary"
                    checked={summaryChoice === "linkedin"}
                    onChange={() => setSummaryChoice("linkedin")}
                  />
                  <div>
                    <p className="font-medium text-xs text-muted-foreground mb-1">
                      Use LinkedIn
                    </p>
                    <p className="line-clamp-2 text-xs">
                      {linkedInProfile.summary}
                    </p>
                  </div>
                </label>
                {currentProfile?.summary && (
                  <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
                    <input
                      type="radio"
                      name="summary"
                      className="mt-0.5 accent-primary"
                      checked={summaryChoice === "merge"}
                      onChange={() => setSummaryChoice("merge")}
                    />
                    <div>
                      <p className="font-medium text-xs text-muted-foreground mb-1">
                        Keep both
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Current and LinkedIn summaries will be joined.
                      </p>
                    </div>
                  </label>
                )}
              </div>
            </section>
          )}

          {/* Work history */}
          {hasExperience && (
            <section>
              <SectionTitle icon={<Briefcase className="size-3.5 text-muted-foreground" />}>
                Work History
              </SectionTitle>
              <div className="space-y-2">
                {linkedInProfile.experience.map((exp, i) => {
                  const isUpdate = (currentProfile?.work_history ?? []).some(
                    (j) => companiesMatch(j.company, exp.company)
                  );
                  return (
                    <CheckRow
                      key={i}
                      checked={selectedJobs.has(i)}
                      onChange={(v) => toggleJob(i, v)}
                      badge={
                        <Badge
                          variant="secondary"
                          className={
                            isUpdate
                              ? "text-orange-700 bg-orange-100 dark:bg-orange-900/30"
                              : "text-green-700 bg-green-100 dark:bg-green-900/30"
                          }
                        >
                          {isUpdate ? "Update" : "Add"}
                        </Badge>
                      }
                    >
                      <div>
                        <p className="text-sm font-medium leading-snug">
                          {exp.title || "(untitled)"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {exp.company}
                          {exp.location ? ` · ${exp.location}` : ""}
                          {exp.startDate
                            ? ` · ${exp.startDate}${exp.current ? " – Present" : exp.endDate ? ` – ${exp.endDate}` : ""}`
                            : ""}
                        </p>
                      </div>
                    </CheckRow>
                  );
                })}
              </div>
            </section>
          )}

          {/* Education */}
          {hasEducation && (
            <section>
              <SectionTitle icon={<GraduationCap className="size-3.5 text-muted-foreground" />}>
                Education
              </SectionTitle>
              <div className="space-y-2">
                {linkedInProfile.education.map((edu, i) => {
                  const isUpdate = (currentProfile?.education ?? []).some(
                    (e) =>
                      e.institution.toLowerCase() ===
                      edu.institution.toLowerCase()
                  );
                  return (
                    <CheckRow
                      key={i}
                      checked={selectedEdus.has(i)}
                      onChange={(v) => toggleEdu(i, v)}
                      badge={
                        <Badge
                          variant="secondary"
                          className={
                            isUpdate
                              ? "text-orange-700 bg-orange-100 dark:bg-orange-900/30"
                              : "text-green-700 bg-green-100 dark:bg-green-900/30"
                          }
                        >
                          {isUpdate ? "Update" : "Add"}
                        </Badge>
                      }
                    >
                      <div>
                        <p className="text-sm font-medium leading-snug">
                          {edu.institution || "(unknown institution)"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[edu.degree, edu.field].filter(Boolean).join(", ")}
                          {edu.startDate
                            ? ` · ${edu.startDate}${edu.endDate ? ` – ${edu.endDate}` : ""}`
                            : ""}
                        </p>
                      </div>
                    </CheckRow>
                  );
                })}
              </div>
            </section>
          )}

          {/* Skills */}
          {(newLinkedInSkills.length > 0 ||
            linkedInProfile.skills.length > 0) && (
            <section>
              <SectionTitle icon={<Star className="size-3.5 text-muted-foreground" />}>
                Skills
              </SectionTitle>
              <div className="flex flex-wrap gap-2">
                {/* Existing skills (greyed out) */}
                {linkedInProfile.skills
                  .filter((s) => allExistingSkills.has(s.toLowerCase()))
                  .map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground bg-muted/50"
                    >
                      {s}
                      <span className="text-[10px] opacity-60">✓</span>
                    </span>
                  ))}
                {/* New skills (selectable) */}
                {newLinkedInSkills.map((s) => (
                  <label
                    key={s}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs cursor-pointer transition-colors ${
                      selectedSkills.has(s)
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="size-3 accent-primary"
                      checked={selectedSkills.has(s)}
                      onChange={(e) => toggleSkill(s, e.target.checked)}
                    />
                    {s}
                  </label>
                ))}
              </div>
              {!hasNewSkills && (
                <p className="text-xs text-muted-foreground mt-1">
                  All LinkedIn skills are already in your profile.
                </p>
              )}
            </section>
          )}

          {/* Certifications */}
          {hasNewCerts && (
            <section>
              <SectionTitle icon={<Star className="size-3.5 text-muted-foreground" />}>
                Certifications
              </SectionTitle>
              <div className="space-y-2">
                {newCerts.map((cert, i) => (
                  <CheckRow
                    key={i}
                    checked={selectedCerts.has(i)}
                    onChange={(v) => toggleCert(i, v)}
                  >
                    <div>
                      <p className="text-sm font-medium leading-snug">
                        {cert.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cert.issuer}
                        {cert.date ? ` · ${cert.date}` : ""}
                      </p>
                    </div>
                  </CheckRow>
                ))}
              </div>
            </section>
          )}

          {/* Languages */}
          {hasNewLangs && (
            <section>
              <SectionTitle icon={<Globe className="size-3.5 text-muted-foreground" />}>
                Languages
              </SectionTitle>
              <div className="space-y-2">
                {newLangs.map((lang, i) => (
                  <CheckRow
                    key={i}
                    checked={selectedLangs.has(i)}
                    onChange={(v) => toggleLang(i, v)}
                  >
                    <p className="text-sm">
                      <span className="font-medium">{lang.language}</span>
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({lang.proficiency})
                      </span>
                    </p>
                  </CheckRow>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {!hasSummaryToImport &&
            !hasExperience &&
            !hasEducation &&
            !hasNewSkills &&
            !hasNewCerts &&
            !hasNewLangs && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No new data found to import. Your profile may already be
                up-to-date.
              </p>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport}>Import Selected</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
