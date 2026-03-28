"use client";

import { Button } from "@/components/ui/button";
import { Search, BarChart3, Briefcase, MessageSquare } from "lucide-react";

type LastTool =
  | "searchJobs"
  | "getApplicationStatus"
  | "prepareApplication"
  | "getProfileSummary"
  | "getWeeklyStats"
  | "searchAnswerLibrary"
  | null;

interface Chip {
  label: string;
  message: string;
  icon?: React.ReactNode;
}

const DEFAULT_CHIPS: Chip[] = [
  {
    label: "Find jobs",
    message: "Search for jobs matching my profile and preferences",
    icon: <Search className="h-3 w-3" />,
  },
  {
    label: "My applications",
    message: "Show me the status of all my applications",
    icon: <Briefcase className="h-3 w-3" />,
  },
  {
    label: "Weekly update",
    message: "Give me my weekly stats and progress report",
    icon: <BarChart3 className="h-3 w-3" />,
  },
  {
    label: "Interview prep",
    message: "Help me prepare for my next interview",
    icon: <MessageSquare className="h-3 w-3" />,
  },
];

const AFTER_JOBS_CHIPS: Chip[] = [
  {
    label: "Apply to top match",
    message: "Prepare an application for the highest-scored job",
  },
  {
    label: "Refine search",
    message: "Let me refine my search criteria",
  },
  {
    label: "Show my applications",
    message: "Show me all my current applications",
  },
];

const AFTER_PACKAGE_CHIPS: Chip[] = [
  {
    label: "Find more jobs",
    message: "Search for more jobs matching my profile",
  },
  {
    label: "View pipeline",
    message: "Show me the status of all my applications",
  },
  {
    label: "Check stats",
    message: "Give me my weekly stats and progress report",
  },
];

const AFTER_PROFILE_CHIPS: Chip[] = [
  {
    label: "Find matching jobs",
    message: "Search for jobs matching my profile and skills",
  },
  {
    label: "Build knowledge",
    message: "What knowledge topics should I focus on completing?",
  },
  {
    label: "Draft application",
    message: "Help me prepare an application for a role",
  },
];

function getChips(lastTool: LastTool): Chip[] {
  switch (lastTool) {
    case "searchJobs":
      return AFTER_JOBS_CHIPS;
    case "prepareApplication":
      return AFTER_PACKAGE_CHIPS;
    case "getProfileSummary":
      return AFTER_PROFILE_CHIPS;
    default:
      return DEFAULT_CHIPS;
  }
}

interface Props {
  lastTool: LastTool;
  onSelect: (message: string) => void;
  disabled?: boolean;
}

export function QuickActionChips({ lastTool, onSelect, disabled }: Props) {
  const chips = getChips(lastTool);

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {chips.map((chip) => (
        <Button
          key={chip.label}
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 rounded-full"
          disabled={disabled}
          onClick={() => onSelect(chip.message)}
        >
          {chip.icon}
          {chip.label}
        </Button>
      ))}
    </div>
  );
}
