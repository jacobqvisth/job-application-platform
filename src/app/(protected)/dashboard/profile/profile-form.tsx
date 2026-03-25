"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Upload,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { saveProfileAction } from "../actions/profile-actions";
import type {
  UserProfileData,
  ExperienceItem,
  EducationItem,
  SkillCategory,
  CertificationItem,
  LanguageItem,
  LanguageProficiency,
} from "@/lib/types/database";

interface ProfileFormProps {
  initialProfile: UserProfileData | null;
}

function newId() {
  return crypto.randomUUID();
}

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  const [summary, setSummary] = useState(initialProfile?.summary ?? "");
  const [workHistory, setWorkHistory] = useState<ExperienceItem[]>(
    initialProfile?.work_history ?? []
  );
  const [education, setEducation] = useState<EducationItem[]>(
    initialProfile?.education ?? []
  );
  const [skills, setSkills] = useState<SkillCategory[]>(
    initialProfile?.skills ?? [
      { id: newId(), name: "Technical Skills", skills: [] },
      { id: newId(), name: "Tools & Frameworks", skills: [] },
      { id: newId(), name: "Soft Skills", skills: [] },
    ]
  );
  const [certifications, setCertifications] = useState<CertificationItem[]>(
    initialProfile?.certifications ?? []
  );
  const [languages, setLanguages] = useState<LanguageItem[]>(
    initialProfile?.languages ?? []
  );
  const [skillInputs, setSkillInputs] = useState<Record<string, string>>({});

  function handleSave() {
    startTransition(async () => {
      const result = await saveProfileAction({
        summary,
        work_history: workHistory,
        education,
        skills,
        certifications,
        languages,
      });
      if (result.success) {
        toast.success("Profile saved successfully");
      } else {
        toast.error(result.error ?? "Failed to save profile");
      }
    });
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".pdf")) {
      toast.error("Please select a PDF file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/resume/parse", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error ?? "Failed to parse resume");
        return;
      }

      const parsed = data.profile;
      if (parsed.summary) setSummary(parsed.summary);
      if (parsed.work_history?.length) setWorkHistory(parsed.work_history);
      if (parsed.education?.length) setEducation(parsed.education);
      if (parsed.skills?.length) setSkills(parsed.skills);
      if (parsed.certifications?.length) setCertifications(parsed.certifications);
      if (parsed.languages?.length) setLanguages(parsed.languages);

      toast.success("Resume parsed! Review and save your profile.");
    } catch {
      toast.error("Failed to parse resume");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  // Work history helpers
  function addJob() {
    setWorkHistory([
      ...workHistory,
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

  function updateJob(id: string, field: keyof ExperienceItem, value: unknown) {
    setWorkHistory(
      workHistory.map((j) => (j.id === id ? { ...j, [field]: value } : j))
    );
  }

  function removeJob(id: string) {
    setWorkHistory(workHistory.filter((j) => j.id !== id));
  }

  function addBullet(jobId: string) {
    setWorkHistory(
      workHistory.map((j) =>
        j.id === jobId ? { ...j, bullets: [...j.bullets, ""] } : j
      )
    );
  }

  function updateBullet(jobId: string, index: number, value: string) {
    setWorkHistory(
      workHistory.map((j) =>
        j.id === jobId
          ? { ...j, bullets: j.bullets.map((b, i) => (i === index ? value : b)) }
          : j
      )
    );
  }

  function removeBullet(jobId: string, index: number) {
    setWorkHistory(
      workHistory.map((j) =>
        j.id === jobId
          ? { ...j, bullets: j.bullets.filter((_, i) => i !== index) }
          : j
      )
    );
  }

  // Education helpers
  function addEducation() {
    setEducation([
      ...education,
      {
        id: newId(),
        institution: "",
        degree: "",
        field: "",
        startDate: "",
        endDate: null,
      },
    ]);
  }

  function updateEducation(
    id: string,
    field: keyof EducationItem,
    value: unknown
  ) {
    setEducation(
      education.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  }

  function removeEducation(id: string) {
    setEducation(education.filter((e) => e.id !== id));
  }

  // Skills helpers
  function addSkillCategory() {
    setSkills([...skills, { id: newId(), name: "", skills: [] }]);
  }

  function updateCategoryName(id: string, name: string) {
    setSkills(skills.map((c) => (c.id === id ? { ...c, name } : c)));
  }

  function removeCategory(id: string) {
    setSkills(skills.filter((c) => c.id !== id));
  }

  function addSkillToCategory(categoryId: string) {
    const input = skillInputs[categoryId]?.trim();
    if (!input) return;
    setSkills(
      skills.map((c) =>
        c.id === categoryId && !c.skills.includes(input)
          ? { ...c, skills: [...c.skills, input] }
          : c
      )
    );
    setSkillInputs({ ...skillInputs, [categoryId]: "" });
  }

  function removeSkill(categoryId: string, skill: string) {
    setSkills(
      skills.map((c) =>
        c.id === categoryId
          ? { ...c, skills: c.skills.filter((s) => s !== skill) }
          : c
      )
    );
  }

  // Cert helpers
  function addCert() {
    setCertifications([
      ...certifications,
      { id: newId(), name: "", issuer: "", date: "" },
    ]);
  }

  function updateCert(id: string, field: keyof CertificationItem, value: string) {
    setCertifications(
      certifications.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  function removeCert(id: string) {
    setCertifications(certifications.filter((c) => c.id !== id));
  }

  // Language helpers
  function addLanguage() {
    setLanguages([
      ...languages,
      { id: newId(), language: "", proficiency: "intermediate" },
    ]);
  }

  function updateLanguage(
    id: string,
    field: keyof LanguageItem,
    value: string
  ) {
    setLanguages(
      languages.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  function removeLanguage(id: string) {
    setLanguages(languages.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-6">
      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending || uploading}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {isPending ? "Saving..." : "Save Profile"}
        </Button>
      </div>

      {/* PDF Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import from Resume (PDF)</CardTitle>
        </CardHeader>
        <CardContent>
          <label
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center transition-colors cursor-pointer hover:border-muted-foreground/60 hover:bg-muted/30 ${
              uploading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handlePdfUpload}
              disabled={uploading}
            />
            {uploading ? (
              <>
                <Loader2 className="mb-2 size-8 animate-spin text-muted-foreground" />
                <p className="text-sm font-medium">Parsing resume...</p>
                <p className="text-xs text-muted-foreground">
                  Claude is extracting your information
                </p>
              </>
            ) : (
              <>
                <Upload className="mb-2 size-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Drop your resume PDF here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">PDF only, max 5MB</p>
              </>
            )}
          </label>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Professional Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="A brief professional summary (2-3 sentences)..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Work History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Work History</CardTitle>
          <Button size="sm" variant="outline" onClick={addJob}>
            <Plus className="size-4" />
            Add Job
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {workHistory.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No work history added yet.
            </p>
          )}
          {workHistory.map((job, jobIdx) => (
            <div
              key={job.id}
              className="space-y-3 rounded-lg border p-4"
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Position {jobIdx + 1}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeJob(job.id)}
                  className="text-destructive hover:text-destructive -mt-1 -mr-2"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Company</Label>
                  <Input
                    value={job.company}
                    onChange={(e) => updateJob(job.id, "company", e.target.value)}
                    placeholder="Acme Corp"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={job.title}
                    onChange={(e) => updateJob(job.id, "title", e.target.value)}
                    placeholder="Software Engineer"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Location</Label>
                  <Input
                    value={job.location}
                    onChange={(e) => updateJob(job.id, "location", e.target.value)}
                    placeholder="San Francisco, CA"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Start (YYYY-MM)</Label>
                    <Input
                      value={job.startDate}
                      onChange={(e) =>
                        updateJob(job.id, "startDate", e.target.value)
                      }
                      placeholder="2022-01"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End (or blank = Present)</Label>
                    <Input
                      value={job.endDate ?? ""}
                      onChange={(e) =>
                        updateJob(
                          job.id,
                          "endDate",
                          e.target.value || null
                        )
                      }
                      placeholder="Present"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Accomplishments</Label>
                {job.bullets.map((bullet, bIdx) => (
                  <div key={bIdx} className="flex gap-2">
                    <Input
                      value={bullet}
                      onChange={(e) =>
                        updateBullet(job.id, bIdx, e.target.value)
                      }
                      placeholder="Describe an achievement..."
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeBullet(job.id, bIdx)}
                      disabled={job.bullets.length === 1}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => addBullet(job.id)}
                  className="text-muted-foreground"
                >
                  <Plus className="size-4" />
                  Add bullet
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Education</CardTitle>
          <Button size="sm" variant="outline" onClick={addEducation}>
            <Plus className="size-4" />
            Add Education
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {education.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No education added yet.
            </p>
          )}
          {education.map((edu) => (
            <div key={edu.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeEducation(edu.id)}
                  className="text-destructive hover:text-destructive -mt-2 -mr-2"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Institution</Label>
                  <Input
                    value={edu.institution}
                    onChange={(e) =>
                      updateEducation(edu.id, "institution", e.target.value)
                    }
                    placeholder="University of Example"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Degree</Label>
                  <Input
                    value={edu.degree}
                    onChange={(e) =>
                      updateEducation(edu.id, "degree", e.target.value)
                    }
                    placeholder="Bachelor of Science"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Field of Study</Label>
                  <Input
                    value={edu.field}
                    onChange={(e) =>
                      updateEducation(edu.id, "field", e.target.value)
                    }
                    placeholder="Computer Science"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Start (YYYY-MM)</Label>
                  <Input
                    value={edu.startDate}
                    onChange={(e) =>
                      updateEducation(edu.id, "startDate", e.target.value)
                    }
                    placeholder="2018-09"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End (or blank = Present)</Label>
                  <Input
                    value={edu.endDate ?? ""}
                    onChange={(e) =>
                      updateEducation(edu.id, "endDate", e.target.value || null)
                    }
                    placeholder="2022-05"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">GPA (optional)</Label>
                  <Input
                    value={edu.gpa ?? ""}
                    onChange={(e) =>
                      updateEducation(edu.id, "gpa", e.target.value)
                    }
                    placeholder="3.8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Input
                    value={edu.notes ?? ""}
                    onChange={(e) =>
                      updateEducation(edu.id, "notes", e.target.value)
                    }
                    placeholder="Honors, minor, etc."
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Skills</CardTitle>
          <Button size="sm" variant="outline" onClick={addSkillCategory}>
            <Plus className="size-4" />
            Add Category
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {skills.map((category) => (
            <div key={category.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Input
                  value={category.name}
                  onChange={(e) =>
                    updateCategoryName(category.id, e.target.value)
                  }
                  placeholder="Category name"
                  className="flex-1 text-sm font-medium"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeCategory(category.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {category.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1">
                    {skill}
                    <button
                      onClick={() => removeSkill(category.id, skill)}
                      className="ml-0.5 rounded-full hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={skillInputs[category.id] ?? ""}
                  onChange={(e) =>
                    setSkillInputs({
                      ...skillInputs,
                      [category.id]: e.target.value,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkillToCategory(category.id);
                    }
                  }}
                  placeholder="Type a skill and press Enter"
                  className="flex-1 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addSkillToCategory(category.id)}
                >
                  Add
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Certifications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Certifications</CardTitle>
          <Button size="sm" variant="outline" onClick={addCert}>
            <Plus className="size-4" />
            Add Certification
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {certifications.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No certifications added.
            </p>
          )}
          {certifications.map((cert) => (
            <div
              key={cert.id}
              className="grid grid-cols-2 gap-3 rounded-lg border p-4"
            >
              <div className="flex justify-end col-span-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeCert(cert.id)}
                  className="text-destructive hover:text-destructive -mt-2 -mr-2"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={cert.name}
                  onChange={(e) => updateCert(cert.id, "name", e.target.value)}
                  placeholder="AWS Solutions Architect"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Issuer</Label>
                <Input
                  value={cert.issuer}
                  onChange={(e) =>
                    updateCert(cert.id, "issuer", e.target.value)
                  }
                  placeholder="Amazon Web Services"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date (YYYY-MM)</Label>
                <Input
                  value={cert.date}
                  onChange={(e) => updateCert(cert.id, "date", e.target.value)}
                  placeholder="2023-06"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL (optional)</Label>
                <Input
                  value={cert.url ?? ""}
                  onChange={(e) => updateCert(cert.id, "url", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Languages */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Languages</CardTitle>
          <Button size="sm" variant="outline" onClick={addLanguage}>
            <Plus className="size-4" />
            Add Language
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {languages.length === 0 && (
            <p className="text-sm text-muted-foreground">No languages added.</p>
          )}
          {languages.map((lang) => (
            <div
              key={lang.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <Input
                value={lang.language}
                onChange={(e) =>
                  updateLanguage(lang.id, "language", e.target.value)
                }
                placeholder="English"
                className="flex-1"
              />
              <Select
                value={lang.proficiency}
                onValueChange={(v) =>
                  updateLanguage(lang.id, "proficiency", v as LanguageProficiency)
                }
              >
                <SelectTrigger className="w-36">
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
                onClick={() => removeLanguage(lang.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bottom save */}
      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={isPending || uploading}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {isPending ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}
