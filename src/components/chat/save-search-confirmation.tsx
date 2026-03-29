"use client";

import { CheckCircle, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SaveJobSearchResult } from "@/lib/chat/types";

interface Props {
  data: SaveJobSearchResult;
  onAppend?: (content: string) => void;
}

export function SaveSearchConfirmation({ data, onAppend }: Props) {
  if (!data.success) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-destructive">{data.message}</p>
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
            <p className="font-medium text-sm text-green-800 dark:text-green-200">Search saved!</p>
            <p className="text-sm mt-1 truncate font-medium">{data.name}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="secondary" className="text-xs">
                {data.query}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <Bell className="h-3 w-3" />
              <span>Nexus will check for new matches daily</span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onAppend?.("navigateTo:jobs")}
          >
            View saved searches
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
