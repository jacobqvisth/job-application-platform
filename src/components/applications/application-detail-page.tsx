"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  ApplicationWithEvents,
  ApplicationEvent,
  ApplicationStatus,
  UserProfileData,
} from "@/lib/types/database";
import type { PrepPack } from "@/lib/data/prep";
import { DetailOverview } from "./detail-overview";
import { DetailTimeline } from "./detail-timeline";
import { DetailPrep } from "./detail-prep";

interface ApplicationDetailPageProps {
  application: ApplicationWithEvents;
  events: ApplicationEvent[];
  prepPack: PrepPack | null;
  profile: UserProfileData | null;
}

export function ApplicationDetailPage({
  application,
  events,
  prepPack,
  profile,
}: ApplicationDetailPageProps) {
  const appliedDate = application.applied_at
    ? new Date(application.applied_at).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/dashboard/applications"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Applications
        </Link>
      </div>

      {/* Document header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight leading-tight">
              {application.company}
            </h1>
            <p className="text-base text-muted-foreground font-medium">
              {application.role}
            </p>
          </div>
          <StatusBadge
            status={application.status as ApplicationStatus}
            className="shrink-0 mt-1"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {application.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {application.location}
              {application.remote_type && ` · ${application.remote_type}`}
            </span>
          )}
          {appliedDate && (
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              Applied {appliedDate}
            </span>
          )}
          {application.url && (
            <a
              href={application.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" />
              Job posting
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="prep">Prep Pack</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <DetailOverview application={application} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <DetailTimeline events={events} />
        </TabsContent>

        <TabsContent value="prep" className="mt-4">
          <DetailPrep
            applicationId={application.id}
            prepPack={prepPack}
            hasJobDescription={!!application.job_description?.trim()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
