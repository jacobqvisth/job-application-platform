"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { AddApplicationDialog } from "@/components/applications/add-application-dialog";
import Link from "next/link";

export function DashboardActions() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex gap-2">
      <Button onClick={() => setDialogOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        New Application
      </Button>
      <Button variant="outline" asChild>
        <Link href="/dashboard/jobs">
          <Search className="mr-2 h-4 w-4" />
          Search Jobs
        </Link>
      </Button>
      <AddApplicationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
