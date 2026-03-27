import Link from "next/link";
import type { Application, ApplicationStatus } from "@/lib/types/database";
import { StatusBadge } from "@/components/ui/status-badge";

interface PipelineTableProps {
  applications: Application[];
}

const STATUS_ORDER: Record<ApplicationStatus, number> = {
  offer: 0,
  interview: 1,
  screening: 2,
  applied: 3,
  saved: 4,
  rejected: 5,
  withdrawn: 6,
};

function daysActive(app: Application): number {
  const from = app.applied_at ?? app.created_at;
  return Math.floor((Date.now() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
}

function sortApplications(apps: Application[]): Application[] {
  return [...apps].sort((a, b) => {
    const statusDiff =
      (STATUS_ORDER[a.status as ApplicationStatus] ?? 99) -
      (STATUS_ORDER[b.status as ApplicationStatus] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return daysActive(b) - daysActive(a);
  });
}

export function PipelineTable({ applications }: PipelineTableProps) {
  if (applications.length === 0) {
    return (
      <div>
        <h2 className="text-base font-semibold mb-4">Active Pipeline</h2>
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">No active applications yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Applications you&apos;re actively pursuing will appear here.
          </p>
          <Link
            href="/dashboard/applications"
            className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
          >
            Add your first application →
          </Link>
        </div>
      </div>
    );
  }

  const sorted = sortApplications(applications);

  return (
    <div>
      <h2 className="text-base font-semibold mb-4">
        Active Pipeline{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({applications.length})
        </span>
      </h2>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                  Days Active
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((app, i) => {
                const days = daysActive(app);
                return (
                  <tr
                    key={app.id}
                    className={i % 2 === 0 ? "" : "bg-muted/10"}
                  >
                    <td className="px-4 py-3 font-medium">{app.company}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {app.role}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status as ApplicationStatus} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {days}d
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href="/dashboard/applications"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
