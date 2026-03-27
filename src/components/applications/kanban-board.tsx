"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  useSensors,
  useSensor,
  PointerSensor,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import Link from "next/link";
import type { Application, ApplicationStatus } from "@/lib/types/database";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import {
  Building2,
  MapPin,
  Calendar,
  GripVertical,
  ExternalLink,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Status column configuration
// ---------------------------------------------------------------------------

interface StatusColumn {
  status: ApplicationStatus;
  label: string;
  color: string;
  bgLight: string;
  textColor: string;
  ringColor: string;
}

const COLUMN_ACCENTS: Record<ApplicationStatus, string> = {
  saved:     "border-t-2 border-t-slate-300",
  applied:   "border-t-2 border-t-blue-400",
  screening: "border-t-2 border-t-violet-400",
  interview: "border-t-2 border-t-amber-400",
  offer:     "border-t-2 border-t-emerald-400",
  rejected:  "border-t-2 border-t-rose-400",
  withdrawn: "border-t-2 border-t-gray-300",
};

const STATUS_COLUMNS: StatusColumn[] = [
  {
    status: "saved",
    label: "Saved",
    color: "bg-gray-500",
    bgLight: "bg-gray-50 dark:bg-gray-900/30",
    textColor: "text-gray-700 dark:text-gray-300",
    ringColor: "ring-gray-200 dark:ring-gray-700",
  },
  {
    status: "applied",
    label: "Applied",
    color: "bg-blue-500",
    bgLight: "bg-blue-50 dark:bg-blue-950/30",
    textColor: "text-blue-700 dark:text-blue-300",
    ringColor: "ring-blue-200 dark:ring-blue-800",
  },
  {
    status: "screening",
    label: "Screening",
    color: "bg-yellow-500",
    bgLight: "bg-yellow-50 dark:bg-yellow-950/30",
    textColor: "text-yellow-700 dark:text-yellow-300",
    ringColor: "ring-yellow-200 dark:ring-yellow-800",
  },
  {
    status: "interview",
    label: "Interview",
    color: "bg-purple-500",
    bgLight: "bg-purple-50 dark:bg-purple-950/30",
    textColor: "text-purple-700 dark:text-purple-300",
    ringColor: "ring-purple-200 dark:ring-purple-800",
  },
  {
    status: "offer",
    label: "Offer",
    color: "bg-green-500",
    bgLight: "bg-green-50 dark:bg-green-950/30",
    textColor: "text-green-700 dark:text-green-300",
    ringColor: "ring-green-200 dark:ring-green-800",
  },
  {
    status: "rejected",
    label: "Rejected",
    color: "bg-red-500",
    bgLight: "bg-red-50 dark:bg-red-950/30",
    textColor: "text-red-700 dark:text-red-300",
    ringColor: "ring-red-200 dark:ring-red-800",
  },
  {
    status: "withdrawn",
    label: "Withdrawn",
    color: "bg-gray-400",
    bgLight: "bg-gray-50 dark:bg-gray-900/30",
    textColor: "text-gray-600 dark:text-gray-400",
    ringColor: "ring-gray-200 dark:ring-gray-700",
  },
];

// ---------------------------------------------------------------------------
// ApplicationCard (sortable / draggable)
// ---------------------------------------------------------------------------

interface ApplicationCardProps {
  application: Application;
  onClick: (app: Application) => void;
  isDragOverlay?: boolean;
}

function ApplicationCard({
  application,
  onClick,
  isDragOverlay = false,
}: ApplicationCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: application.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formattedDate = application.applied_at
    ? new Date(application.applied_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={!isDragOverlay ? style : undefined}
      className={cn(
        "group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md",
        isDragging && "opacity-30",
        isDragOverlay && "rotate-2 shadow-lg ring-2 ring-primary/20"
      )}
      onClick={() => onClick(application)}
      {...(!isDragOverlay ? attributes : {})}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          {...(!isDragOverlay ? listeners : {})}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-sm font-medium leading-tight">
            {application.role}
          </p>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{application.company}</span>
          </div>

          {application.location && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{application.location}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {application.salary_range && (
              <Badge variant="secondary" className="text-[10px]">
                {application.salary_range}
              </Badge>
            )}
            {formattedDate && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />
                {formattedDate}
              </span>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Link
              href={`/dashboard/applications/${application.id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KanbanColumn (droppable)
// ---------------------------------------------------------------------------

interface KanbanColumnProps {
  column: StatusColumn;
  applications: Application[];
  onCardClick: (app: Application) => void;
}

function KanbanColumn({ column, applications, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
  });

  return (
    <Card
      className={cn(
        "flex h-full w-72 shrink-0 flex-col overflow-hidden transition-colors",
        COLUMN_ACCENTS[column.status],
        isOver && "ring-2 ring-primary/30"
      )}
    >
      {/* Column header */}
      <CardHeader className="space-y-0 border-b p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <StatusBadge status={column.status} />
          <Badge
            variant="secondary"
            className={cn(
              "h-5 min-w-[20px] justify-center rounded-full px-1.5 text-[10px] font-semibold",
              column.bgLight,
              column.textColor
            )}
          >
            {applications.length}
          </Badge>
        </div>
      </CardHeader>

      {/* Droppable card list area */}
      <CardContent className="flex-1 overflow-hidden p-0">
        <div
          ref={setNodeRef}
          className={cn(
            "flex h-full min-h-[200px] flex-col gap-2 overflow-y-auto p-2 transition-colors",
            isOver && column.bgLight
          )}
        >
          <SortableContext
            items={applications.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            {applications.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                onClick={onCardClick}
              />
            ))}
          </SortableContext>

          {applications.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4">
              <p className="text-center text-xs text-muted-foreground">
                Drop applications here
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// KanbanBoard (main component)
// ---------------------------------------------------------------------------

interface KanbanBoardProps {
  applications: Application[];
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onCardClick: (app: Application) => void;
}

export function KanbanBoard({
  applications,
  onStatusChange,
  onCardClick,
}: KanbanBoardProps) {
  const [activeApp, setActiveApp] = useState<Application | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group applications by status
  const applicationsByStatus = STATUS_COLUMNS.reduce(
    (acc, col) => {
      acc[col.status] = applications.filter((a) => a.status === col.status);
      return acc;
    },
    {} as Record<ApplicationStatus, Application[]>
  );

  function handleDragStart(event: DragStartEvent) {
    const app = applications.find((a) => a.id === event.active.id);
    setActiveApp(app ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveApp(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Determine the target column. The `over` could be a column ID (status)
    // or another card ID. If it is a card, look up that card's status.
    let targetStatus: ApplicationStatus | undefined;

    if (STATUS_COLUMNS.some((col) => col.status === overId)) {
      targetStatus = overId as ApplicationStatus;
    } else {
      const overApp = applications.find((a) => a.id === overId);
      targetStatus = overApp?.status;
    }

    if (!targetStatus) return;

    const sourceApp = applications.find((a) => a.id === activeId);
    if (!sourceApp || sourceApp.status === targetStatus) return;

    onStatusChange(activeId, targetStatus);
  }

  function handleDragCancel() {
    setActiveApp(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.status}
            column={column}
            applications={applicationsByStatus[column.status] ?? []}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeApp ? (
          <div className="w-72">
            <ApplicationCard
              application={activeApp}
              onClick={() => {}}
              isDragOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
