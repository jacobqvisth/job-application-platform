"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Link from "next/link";

interface SaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCompany: string;
  defaultRole: string;
  jobDescription: string;
  coverLetter: string;
  screeningAnswers: Array<{ question: string; answer: string; tags: string[] }>;
  onSaved: () => void;
}

export function SaveDialog({
  open,
  onOpenChange,
  defaultCompany,
  defaultRole,
  jobDescription,
  coverLetter,
  screeningAnswers,
  onSaved,
}: SaveDialogProps) {
  const [company, setCompany] = useState(defaultCompany);
  const [role, setRole] = useState(defaultRole);
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("");
  const [remoteType, setRemoteType] = useState<string>("");
  const [markAsApplied, setMarkAsApplied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync defaults when dialog opens
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setCompany(defaultCompany);
      setRole(defaultRole);
    }
    onOpenChange(val);
  };

  async function handleSave() {
    if (!company.trim() || !role.trim()) {
      toast.error("Company and role are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/application/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          role: role.trim(),
          jobDescription,
          coverLetter,
          screeningAnswers,
          url: url.trim() || undefined,
          location: location.trim() || undefined,
          remoteType: remoteType || undefined,
          markAsApplied,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save application");
        return;
      }
      toast.success(
        <span>
          Application saved!{" "}
          <Link href="/dashboard/applications" className="underline font-medium">
            View in tracker →
          </Link>
        </span>
      );
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save to Applications</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="save-company">Company</Label>
              <Input
                id="save-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="save-role">Role</Label>
              <Input
                id="save-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Senior PM"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="save-url">Job URL (optional)</Label>
            <Input
              id="save-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="save-location">Location (optional)</Label>
              <Input
                id="save-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="New York, NY"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Remote type</Label>
              <Select value={remoteType} onValueChange={setRemoteType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="onsite">On-site</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={markAsApplied}
              onChange={(e) => setMarkAsApplied(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Mark as applied</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Application
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
