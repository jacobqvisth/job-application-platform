"use client";

import { CheckCircle, Info, XCircle, Kanban, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SaveJobToTrackerResult } from "@/lib/chat/types";

interface Props {
  data: SaveJobToTrackerResult;
  onAppend?: (content: string) => void;
}

export function SaveJobConfirmation({ data, onAppend }: Props) {
  // Already applied — orange/amber warning
  if (data.alreadyApplied) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-amber-800 dark:text-amber-200">Already Applied</p>
              <p className="text-sm text-muted-foreground mt-1">
                {data.warningMessage ?? data.message}
              </p>
              {data.applicationId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs mt-3"
                  onClick={() => onAppend?.("Show me my application board")}
                >
                  <Kanban className="h-3 w-3 mr-1" />
                  View Application
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Already saved (seen from another source) — blue info
  if (data.alreadyExists) {
    return (
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-blue-800 dark:text-blue-200">Already in your tracker</p>
              <p className="text-sm text-muted-foreground mt-1">
                {data.warningMessage ?? data.message}
              </p>
              {data.applicationId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs mt-3"
                  onClick={() => onAppend?.("Show me my application board")}
                >
                  <Kanban className="h-3 w-3 mr-1" />
                  View on board
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data.success) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{data.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-green-800 dark:text-green-200">Saved to tracker!</p>
            <p className="text-sm text-muted-foreground mt-1">{data.message}</p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs mt-3"
              onClick={() => onAppend?.("Show me my application board")}
            >
              <Kanban className="h-3 w-3 mr-1" />
              View on board
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
