"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  FileText,
  MoreHorizontal,
  Copy,
  Trash2,
  Download,
  Edit,
  User,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { ResumePreview } from "@/components/resumes/resume-preview";
import {
  createBlankResumeAction,
  createResumeFromProfileAction,
  deleteResumeAction,
  duplicateResumeAction,
} from "../actions/resume-actions";
import type { ResumeWithApplication } from "@/lib/types/database";

interface ResumesListProps {
  resumes: ResumeWithApplication[];
  hasProfile: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function downloadFile(url: string, resumeId: string, format: "pdf" | "docx") {
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

export function ResumesList({ resumes, hasProfile }: ResumesListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newResumeName, setNewResumeName] = useState("");
  const [creating, setCreating] = useState<"blank" | "profile" | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  function handleCreateBlank() {
    if (!newResumeName.trim()) return;
    setCreating("blank");
    startTransition(async () => {
      const result = await createBlankResumeAction(newResumeName.trim());
      if (result.success && result.resumeId) {
        setCreateDialogOpen(false);
        setNewResumeName("");
        router.push(`/dashboard/resumes/${result.resumeId}`);
      } else {
        toast.error(result.error ?? "Failed to create resume");
      }
      setCreating(null);
    });
  }

  function handleCreateFromProfile() {
    if (!newResumeName.trim()) return;
    setCreating("profile");
    startTransition(async () => {
      const result = await createResumeFromProfileAction(newResumeName.trim());
      if (result.success && result.resumeId) {
        setCreateDialogOpen(false);
        setNewResumeName("");
        router.push(`/dashboard/resumes/${result.resumeId}`);
      } else {
        toast.error(result.error ?? "Failed to create resume");
      }
      setCreating(null);
    });
  }

  function handleDelete(resumeId: string) {
    if (!window.confirm("Delete this resume? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteResumeAction(resumeId);
      if (result.success) {
        toast.success("Resume deleted");
      } else {
        toast.error(result.error ?? "Failed to delete resume");
      }
    });
  }

  function handleDuplicate(resume: ResumeWithApplication) {
    const name = `${resume.name} (copy)`;
    startTransition(async () => {
      const result = await duplicateResumeAction(resume.id, name);
      if (result.success && result.resumeId) {
        toast.success("Resume duplicated");
        router.push(`/dashboard/resumes/${result.resumeId}`);
      } else {
        toast.error(result.error ?? "Failed to duplicate resume");
      }
    });
  }

  async function handleExport(resumeId: string, format: "pdf" | "docx") {
    setExporting(`${resumeId}-${format}`);
    try {
      await downloadFile(
        `/api/resume/export/${format}`,
        resumeId,
        format
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex gap-2">
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="size-4" />
          New Resume
        </Button>
      </div>

      {resumes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FileText className="mx-auto mb-3 size-10 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No resumes yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            {hasProfile
              ? "Create a resume from your profile or start blank."
              : "Set up your profile first to quickly generate a resume."}
          </p>
          <div className="flex justify-center gap-2">
            {!hasProfile && (
              <Button variant="outline" asChild>
                <Link href="/dashboard/profile">
                  <User className="size-4" />
                  Set up Profile
                </Link>
              </Button>
            )}
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="size-4" />
              New Resume
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <Card key={resume.id} className="group overflow-hidden">
              {/* Preview thumbnail */}
              <div className="relative h-48 overflow-hidden bg-gray-50">
                <div className="absolute inset-0 scale-[0.35] origin-top-left">
                  <div style={{ width: "285%", height: "285%" }}>
                    <ResumePreview
                      content={resume.content}
                      name={resume.name}
                    />
                  </div>
                </div>
                <div className="absolute inset-0 bg-transparent group-hover:bg-black/5 transition-colors" />
                <Link
                  href={`/dashboard/resumes/${resume.id}`}
                  className="absolute inset-0"
                  aria-label={`Edit ${resume.name}`}
                />
              </div>

              <CardContent className="p-3 pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{resume.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {timeAgo(resume.updated_at)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-mr-2 -mt-1 shrink-0"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/resumes/${resume.id}`}>
                          <Edit className="mr-2 size-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDuplicate(resume)}
                        disabled={isPending}
                      >
                        <Copy className="mr-2 size-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleExport(resume.id, "pdf")}
                        disabled={!!exporting}
                      >
                        {exporting === `${resume.id}-pdf` ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 size-4" />
                        )}
                        Export PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExport(resume.id, "docx")}
                        disabled={!!exporting}
                      >
                        {exporting === `${resume.id}-docx` ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 size-4" />
                        )}
                        Export DOCX
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(resume.id)}
                        className="text-destructive focus:text-destructive"
                        disabled={isPending}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>

              <CardFooter className="px-3 pb-3 pt-2 flex flex-wrap gap-1.5">
                {resume.is_base && (
                  <Badge variant="default" className="text-xs">
                    Base
                  </Badge>
                )}
                {resume.tailored_for_application_id && resume.applications && (
                  <Badge variant="secondary" className="text-xs">
                    Tailored · {resume.applications.company}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs capitalize">
                  {resume.content.template}
                </Badge>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Resume</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Resume Name</Label>
              <Input
                value={newResumeName}
                onChange={(e) => setNewResumeName(e.target.value)}
                placeholder="e.g. Software Engineer Resume"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newResumeName.trim()) {
                    handleCreateBlank();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {hasProfile && (
              <Button
                variant="outline"
                onClick={handleCreateFromProfile}
                disabled={!newResumeName.trim() || isPending}
                className="w-full sm:w-auto"
              >
                {creating === "profile" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <User className="size-4" />
                )}
                Create from Profile
              </Button>
            )}
            <Button
              onClick={handleCreateBlank}
              disabled={!newResumeName.trim() || isPending}
              className="w-full sm:w-auto"
            >
              {creating === "blank" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create Blank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
