"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Wand2, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import type { Resume } from "@/lib/types/database";

interface ApplicationResumesProps {
  applicationId: string;
  jobDescription: string | null;
}

export function ApplicationResumes({
  applicationId,
  jobDescription,
}: ApplicationResumesProps) {
  const [allResumes, setAllResumes] = useState<Resume[]>([]);
  const [linkedResumes, setLinkedResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/resume/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setAllResumes(data.resumes);
          setLinkedResumes(
            data.resumes.filter(
              (r: Resume) => r.tailored_for_application_id === applicationId
            )
          );
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [applicationId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading resumes...
      </div>
    );
  }

  if (allResumes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        <p>No resumes yet.</p>
        <Button variant="link" className="h-auto p-0 text-xs" asChild>
          <Link href="/dashboard/resumes">Create a resume →</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Linked resumes */}
      {linkedResumes.length > 0 && (
        <div className="space-y-1.5">
          {linkedResumes.map((resume) => (
            <div
              key={resume.id}
              className="flex items-center justify-between gap-2 rounded-lg border p-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{resume.name}</span>
                <Badge variant="secondary" className="text-xs shrink-0">
                  Tailored
                </Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                <Link href={`/dashboard/resumes/${resume.id}`}>
                  <ExternalLink className="size-3" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Tailor a resume for this job */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Tailor a resume for this job:</p>
        <div className="flex gap-2">
          <Select
            onValueChange={(resumeId) => {
              const url = `/dashboard/resumes/${resumeId}`;
              window.open(url, "_blank");
            }}
          >
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue placeholder="Select a resume..." />
            </SelectTrigger>
            <SelectContent>
              {allResumes.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-xs">
                  {r.name}
                  {r.is_base && " (Base)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {jobDescription && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0"
              asChild
            >
              <Link href="/dashboard/resumes">
                <Wand2 className="size-3.5" />
                Tailor
              </Link>
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Open the editor and click &ldquo;Tailor for Job&rdquo; to customize with AI.
        </p>
      </div>
    </div>
  );
}
