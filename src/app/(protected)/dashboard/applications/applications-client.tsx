"use client";

import { useState, useTransition } from "react";
import { Application, ApplicationStatus, ApplicationWithEvents } from "@/lib/types/database";
import { KanbanBoard } from "@/components/applications/kanban-board";
import { AddApplicationDialog } from "@/components/applications/add-application-dialog";
import { ApplicationDetail } from "@/components/applications/application-detail";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { updateApplicationAction } from "@/app/(protected)/dashboard/actions/application-actions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ApplicationsPageClientProps {
  initialApplications: Application[];
}

export function ApplicationsPageClient({
  initialApplications,
}: ApplicationsPageClientProps) {
  const [applications, setApplications] = useState(initialApplications);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ApplicationWithEvents | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (id: string, status: ApplicationStatus) => {
    // Optimistic update
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status } : app))
    );

    startTransition(async () => {
      const result = await updateApplicationAction(id, { status });
      if (!result.success) {
        // Revert on failure
        setApplications(initialApplications);
        toast.error("Failed to update status");
      } else {
        toast.success("Status updated");
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
      // Refresh data by refetching
      setSelectedApp(null);
    }
  };

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
    </div>
  );
}
