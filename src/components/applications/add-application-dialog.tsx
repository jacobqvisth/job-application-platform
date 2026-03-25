"use client";

import { useTransition, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createApplicationAction } from "@/app/(protected)/dashboard/actions/application-actions";
import type { ApplicationStatus, RemoteType } from "@/lib/types/database";

interface AddApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const initialFormState = {
  company: "",
  role: "",
  url: "",
  status: "saved" as ApplicationStatus,
  location: "",
  remote_type: "" as string,
  salary_range: "",
  contact_name: "",
  contact_email: "",
  notes: "",
  job_description: "",
};

export function AddApplicationDialog({
  open,
  onOpenChange,
}: AddApplicationDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(initialFormState);

  function resetForm() {
    setForm(initialFormState);
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.company.trim()) {
      toast.error("Company is required");
      return;
    }
    if (!form.role.trim()) {
      toast.error("Role is required");
      return;
    }

    startTransition(async () => {
      const result = await createApplicationAction({
        company: form.company.trim(),
        role: form.role.trim(),
        url: form.url.trim() || null,
        status: form.status,
        location: form.location.trim() || null,
        remote_type: (form.remote_type as RemoteType) || null,
        salary_range: form.salary_range.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        notes: form.notes.trim() || null,
        job_description: form.job_description.trim() || null,
      });

      if (result.success) {
        toast.success("Application added");
        resetForm();
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Failed to add application");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Application</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company">
                Company <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company"
                name="company"
                placeholder="Company name"
                value={form.company}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role"
                name="role"
                placeholder="Job title"
                value={form.role}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                name="url"
                type="url"
                placeholder="https://..."
                value={form.url}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="saved">Saved</option>
                <option value="applied">Applied</option>
                <option value="screening">Screening</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                placeholder="City, State"
                value={form.location}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remote_type">Remote Type</Label>
              <select
                id="remote_type"
                name="remote_type"
                value={form.remote_type}
                onChange={handleChange}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="">--</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">Onsite</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary_range">Salary Range</Label>
              <Input
                id="salary_range"
                name="salary_range"
                placeholder="e.g. $100k - $130k"
                value={form.salary_range}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input
                id="contact_name"
                name="contact_name"
                placeholder="Recruiter / hiring manager"
                value={form.contact_name}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                placeholder="contact@company.com"
                value={form.contact_email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Any notes about this application..."
              rows={3}
              value={form.notes}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="job_description">Job Description</Label>
            <Textarea
              id="job_description"
              name="job_description"
              placeholder="Paste the job description here..."
              rows={6}
              value={form.job_description}
              onChange={handleChange}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add Application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
