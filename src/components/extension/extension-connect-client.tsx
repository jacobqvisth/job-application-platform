"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Puzzle, CheckCircle2 } from "lucide-react";

interface ExtensionConnectClientProps {
  isAuthenticated: boolean;
}

export function ExtensionConnectClient({ isAuthenticated }: ExtensionConnectClientProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Browser Extension</h1>
        <p className="text-sm text-muted-foreground">
          Autofill job applications from your profile on Greenhouse, Lever, and Workday
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              1
            </span>
            Install the extension
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-4">
            <li>
              Open <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">chrome://extensions</code> in Chrome
            </li>
            <li>Enable <strong>Developer Mode</strong> (toggle in the top-right)</li>
            <li>
              Click <strong>Load unpacked</strong> and select the{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">extension/</code>{" "}
              folder from the project root
            </li>
            <li>The Job Copilot icon should appear in your toolbar</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              2
            </span>
            Connect the extension
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The extension reads your session from this page automatically. Click{" "}
            <strong>Connect Extension</strong> below, then click the extension icon in your
            toolbar — it should show <strong>Connected</strong>.
          </p>

          {isAuthenticated ? (
            <div className="space-y-3">
              <Button className="gap-2">
                <Puzzle className="size-4" />
                Connect Extension
              </Button>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-green-500" />
                Your session is available on this page — the extension will pick it up automatically
              </p>
            </div>
          ) : (
            <p className="text-sm text-destructive">
              You must be signed in to connect the extension.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What the extension can do</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-500">✓</span>
              <span>
                <strong>Autofill forms</strong> on Greenhouse, Lever, and Workday with your profile data
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-500">✓</span>
              <span>
                <strong>Open Draft Wizard</strong> pre-filled with the job description from any ATS page
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-500">✓</span>
              <span>
                <strong>Save to Tracker</strong> with one click — creates a saved application
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-500">✓</span>
              <span>
                <strong>LinkedIn job pages</strong> — capture the JD and company name (read-only, no form interaction)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-amber-500">—</span>
              <span>Never auto-submits anything — you are always in control</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
