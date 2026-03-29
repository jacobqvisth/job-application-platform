"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Calendar,
  FileText,
  MapPin,
  Globe,
  User,
  Mail,
  Trash2,
  Plus,
  Clock,
} from "lucide-react";
import {
  updateApplicationAction,
  deleteApplicationAction,
  addNoteAction,
  scheduleFollowupAction,
} from "@/app/(protected)/dashboard/actions/application-actions";
import type {
  ApplicationWithEvents,
  ApplicationStatus,
  RemoteType,
} from "@/lib/types/database";
import { ApplicationTimeline } from "./application-timeline";
import { ApplicationEmails } from "@/components/emails/application-emails";
import { ApplicationResumes } from "./application-resumes";

const STATUS_OPTIONS: ApplicationStatus[] = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];

const REMOTE_TYPE_OPTIONS: { value: RemoteType; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite" },
  { value: null, label: "Not specified" },
];


interface ApplicationDetailProps {
  application: ApplicationWithEvents | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApplicationDetail({
  application,
  open,
  onOpenChange,
}: ApplicationDetailProps) {
  const [isPending, startTransition] = useTransition();

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("");
  const [remoteType, setRemoteType] = useState<RemoteType>(null);
  const [salaryRange, setSalaryRange] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [status, setStatus] = useState<ApplicationStatus>("saved");

  const [newNote, setNewNote] = useState("");
  const [followupDate, setFollowupDate] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (application) {
      setCompany(application.company);
      setRole(application.role);
      setUrl(application.url ?? "");
      setLocation(application.location ?? "");
      setRemoteType(application.remote_type);
      setSalaryRange(application.salary_range ?? "");
      setContactName(application.contact_name ?? "");
      setContactEmail(application.contact_email ?? "");
      setNotes(application.notes ?? "");
      setJobDescription(application.job_description ?? "");
      setStatus(application.status);
      setNewNote("");
      setFollowupDate("");
    }
  }, [application]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!application) return null;

  function handleStatusChange(newStatus: ApplicationStatus) {
    setStatus(newStatus);
    startTransition(async () => {
      const result = await updateApplicationAction(application!.id, {
        status: newStatus,
      });
      if (result.success) {
        toast.success("Status updated");
      } else {
        toast.error(result.error ?? "Failed to update status");
        setStatus(application!.status);
      }
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateApplicationAction(application!.id, {
        company,
        role,
        url: url || null,
        location: location || null,
        remote_type: remoteType,
        salary_range: salaryRange || null,
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        notes: notes || null,
        job_description: jobDescription || null,
      });
      if (result.success) {
        toast.success("Application updated");
      } else {
        toast.error(result.error ?? "Failed to update application");
      }
    });
  }

  function handleAddNote() {
    if (!newNote.trim()) return;
    startTransition(async () => {
      const result = await addNoteAction(application!.id, newNote.trim());
      if (result.success) {
        toast.success("Note added");
        setNewNote("");
      } else {
        toast.error(result.error ?? "Failed to add note");
      }
    });
  }

  function handleScheduleFollowup() {
    if (!followupDate) return;
    startTransition(async () => {
      const result = await scheduleFollowupAction(
        application!.id,
        followupDate
      );
      if (result.success) {
        toast.success("Follow-up scheduled");
        setFollowupDate("");
      } else {
        toast.error(result.error ?? "Failed to schedule follow-up");
      }
    });
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Are you sure you want to delete the application for ${application!.role} at ${application!.company}? This action cannot be undone.`
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteApplicationAction(application!.id);
      if (result.success) {
        toast.success("Application deleted");
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Failed to delete application");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {application.company} — {application.role}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <StatusBadge status={status} />
            {application.applied_at && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="size-3" />
                Applied{" "}
                {new Date(application.applied_at).toLocaleDateString()}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-8">
          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(e) =>
                handleStatusChange(e.target.value as ApplicationStatus)
              }
              disabled={isPending}
              className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <Separator />

          {/* Editable Fields */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Details</h3>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url" className="flex items-center gap-1.5">
                <Globe className="size-3.5" />
                Job URL
              </Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                Location
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remote_type">Work Type</Label>
              <select
                id="remote_type"
                value={remoteType ?? ""}
                onChange={(e) =>
                  setRemoteType(
                    (e.target.value || null) as RemoteType
                  )
                }
                disabled={isPending}
                className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                {REMOTE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value ?? ""}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary_range">Salary Range</Label>
              <Input
                id="salary_range"
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
                placeholder="e.g. $120k - $150k"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="contact_name"
                className="flex items-center gap-1.5"
              >
                <User className="size-3.5" />
                Contact Name
              </Label>
              <Input
                id="contact_name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="contact_email"
                className="flex items-center gap-1.5"
              >
                <Mail className="size-3.5" />
                Contact Email
              </Label>
              <Input
                id="contact_email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job_description">Job Description</Label>
              <Textarea
                id="job_description"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={4}
                disabled={isPending}
              />
            </div>

            <Button onClick={handleSave} disabled={isPending} className="w-full">
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          <Separator />

          {/* Timeline */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <Clock className="size-3.5" />
              Timeline
            </h3>
            <ApplicationTimeline events={application.application_events} />
          </div>

          <Separator />

          {/* Emails */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <Mail className="size-3.5" />
              Emails
            </h3>
            <ApplicationEmails applicationId={application.id} />
          </div>

          <Separator />

          {/* Resume */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <FileText className="size-3.5" />
              Resume
            </h3>
            <ApplicationResumes
              applicationId={application.id}
              jobDescription={jobDescription}
            />
          </div>

          <Separator />

          {/* Add Note */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <Plus className="size-3.5" />
              Add Note
            </h3>
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a note..."
              rows={2}
              disabled={isPending}
            />
            <Button
              onClick={handleAddNote}
              disabled={isPending || !newNote.trim()}
              variant="outline"
              size="sm"
            >
              {isPending ? "Adding..." : "Add Note"}
            </Button>
          </div>

          <Separator />

          {/* Schedule Follow-up */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <Calendar className="size-3.5" />
              Schedule Follow-up
            </h3>
            <Input
              type="date"
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
              disabled={isPending}
              min={new Date().toISOString().split("T")[0]}
            />
            <Button
              onClick={handleScheduleFollowup}
              disabled={isPending || !followupDate}
              variant="outline"
              size="sm"
            >
              {isPending ? "Scheduling..." : "Schedule Follow-up"}
            </Button>
          </div>

          <Separator />

          {/* Delete */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-destructive">
              Danger Zone
            </h3>
            <Button
              onClick={handleDelete}
              disabled={isPending}
              variant="destructive"
              className="w-full"
            >
              <Trash2 className="size-4" />
              {isPending ? "Deleting..." : "Delete Application"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
