"use client";

import { useState, useTransition } from "react";
import { Application, ApplicationStatus, ApplicationWithEvents } from "@/lib/types/database";
import { KanbanBoard } from "@/components/applications/kanban-board";
import { AddApplicationDialog } from "@/components/applications/add-application-dialog";
import { ApplicationDetail } from "@/components/applications/application-detail";
import { LinkedInShareButton } from "@/components/share/linkedin-share-button";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { updateApplicationAction } from "@/app/(protected)/dashboard/actions/application-actions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ApplicationsPageClientProps {
  initialApplications: Application[];
  linkedInConnected: boolean;
}

export function ApplicationsPageClient({
  initialApplications,
  linkedInConnected,
}: ApplicationsPageClientProps) {
  const [applications, setApplications] = useState(initialApplications);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ApplicationWithEvents | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingShare, setPendingShare] = useState<{
    company: string;
    role: string;
    status: "interview" | "offer";
  } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const handleStatusChange = (id: string, status: ApplicationStatus) => {
    const app = applications.find((a) => a.id === id);

    // Optimistic update
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );

    startTransition(async () => {
      const result = await updateApplicationAction(id, { status });
      if (!result.success) {
        // Revert on failure
        setApplications(initialApplications);
        toast.error("Failed to update status");
      } else {
        toast.success("Status updated");
        // Prompt to share on LinkedIn for milestone statuses
        if (app && (status === "interview" || status === "offer")) {
          setPendingShare({ company: app.company, role: app.role, status });
          setShareOpen(true);
        }
      }
    });
  };

  const handleCardClick = async (app: Application) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("applications")
      .select("*, application_events(*)")
      .eq("id", app.id)
      .order("created_at", {
        referencedTable: "application_events",
        ascending: false,
      })
      .single();

    if (data) {
      setSelectedApp(data);
      setDetailOpen(true);
    }
  };

  const handleDetailClose = (open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setSelectedApp(null);
    }
  };

  const shareText = pendingShare
    ? pendingShare.status === "interview"
      ? `Excited to share that I've been invited for an interview at ${pendingShare.company} for the ${pendingShare.role} position! 🎉 #jobsearch #career`
      : `Thrilled to announce that I've received an offer from ${pendingShare.company}! 🎊 #newjob #career`
    : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground">
            Drag cards between columns to update status
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Application
        </Button>
      </div>

      <KanbanBoard
        applications={applications}
        onStatusChange={handleStatusChange}
        onCardClick={handleCardClick}
      />

      <AddApplicationDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      <ApplicationDetail
        application={selectedApp}
        open={detailOpen}
        onOpenChange={handleDetailClose}
      />

      {/* LinkedIn share dialog — triggered when status changes to interview/offer */}
      {pendingShare && (
        <LinkedInShareButton
          defaultText={shareText}
          isConnected={linkedInConnected}
          open={shareOpen}
          onOpenChange={(open) => {
            setShareOpen(open);
            if (!open) setPendingShare(null);
          }}
        />
      )}
    </div>
  );
}
