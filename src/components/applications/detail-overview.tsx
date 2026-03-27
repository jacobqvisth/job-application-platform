"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import { updateApplicationNotesAction } from "@/app/(protected)/dashboard/applications/[id]/actions";
import type { ApplicationWithEvents } from "@/lib/types/database";

interface DetailOverviewProps {
  application: ApplicationWithEvents;
}

export function DetailOverview({ application }: DetailOverviewProps) {
  const [notes, setNotes] = useState(application.notes ?? "");
  const [, startTransition] = useTransition();

  function handleNotesBlur() {
    startTransition(async () => {
      await updateApplicationNotesAction(application.id, notes);
    });
  }

  const draftLink = `/dashboard/draft?company=${encodeURIComponent(application.company)}&role=${encodeURIComponent(application.role)}`;

  return (
    <div className="space-y-6">
      {/* Job Description */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Job Description</h3>
        {application.job_description?.trim() ? (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {application.job_description}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No job description saved.{" "}
            <Link href={draftLink} className="text-primary hover:underline">
              Add one via the Draft Wizard →
            </Link>
          </div>
        )}
      </div>

      {/* Cover Letter (collapsible) */}
      {application.cover_letter?.trim() && (
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm font-semibold select-none">
            Cover Letter
          </summary>
          <div className="mt-2 rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {application.cover_letter}
          </div>
        </details>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Notes</h3>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Add notes about this application..."
          rows={4}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">Auto-saves on blur</p>
      </div>

      {/* Key Details grid */}
      {(application.salary_range ||
        application.remote_type ||
        application.contact_name ||
        application.contact_email ||
        application.next_followup_at) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Key Details</h3>
          <div className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm">
            {application.salary_range && (
              <div>
                <p className="text-xs text-muted-foreground">Salary</p>
                <p className="font-medium">{application.salary_range}</p>
              </div>
            )}
            {application.remote_type && (
              <div>
                <p className="text-xs text-muted-foreground">Work type</p>
                <p className="font-medium capitalize">
                  {application.remote_type}
                </p>
              </div>
            )}
            {application.contact_name && (
              <div>
                <p className="text-xs text-muted-foreground">Contact</p>
                <p className="font-medium">{application.contact_name}</p>
              </div>
            )}
            {application.contact_email && (
              <div>
                <p className="text-xs text-muted-foreground">Contact email</p>
                <a
                  href={`mailto:${application.contact_email}`}
                  className="font-medium text-primary hover:underline"
                >
                  {application.contact_email}
                </a>
              </div>
            )}
            {application.next_followup_at && (
              <div>
                <p className="text-xs text-muted-foreground">Follow-up</p>
                <p className="font-medium">
                  {new Date(application.next_followup_at).toLocaleDateString(
                    "en-US",
                    { day: "numeric", month: "short", year: "numeric" }
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
