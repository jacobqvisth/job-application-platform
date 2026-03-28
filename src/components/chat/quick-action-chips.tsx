"use client";

import { Button } from "@/components/ui/button";
import { Search, BarChart3, Briefcase, MessageSquare, FileText, Kanban, Mail } from "lucide-react";
import type { FlowContext } from "@/lib/chat/flow-context";
import { trackInteraction } from "@/lib/chat/track-interaction";

type LastTool =
  | "searchJobs"
  | "getApplicationStatus"
  | "prepareApplication"
  | "getProfileSummary"
  | "getWeeklyStats"
  | "searchAnswerLibrary"
  | "showApplicationBoard"
  | "showResumePreview"
  | "showInterviewPrep"
  | "navigateTo"
  | "draftFollowUpEmail"
  | "practiceInterviewQuestion"
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
    message: "Show me my application board",
    icon: <Kanban className="h-3 w-3" />,
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
    message: "Prepare an application for the highest-scored job from my search",
  },
  {
    label: "Refine search",
    message: "Let me refine my search criteria",
  },
  {
    label: "Show my board",
    message: "Show me my application board",
  },
];

const AFTER_PACKAGE_CHIPS: Chip[] = [
  {
    label: "Apply to next match",
    message: "Apply to the next highest-scored job from my search",
  },
  {
    label: "Draft follow-up",
    message: "Draft a follow-up email for this application",
    icon: <Mail className="h-3 w-3" />,
  },
  {
    label: "View pipeline",
    message: "Show me my updated application board",
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
    label: "View my resume",
    message: "Show me my resume",
    icon: <FileText className="h-3 w-3" />,
  },
];

const AFTER_BOARD_CHIPS: Chip[] = [
  {
    label: "Prep for interview",
    message: "Help me prepare for my next interview",
    icon: <MessageSquare className="h-3 w-3" />,
  },
  {
    label: "Weekly stats",
    message: "Give me my weekly stats and progress report",
    icon: <BarChart3 className="h-3 w-3" />,
  },
  {
    label: "Find more jobs",
    message: "Search for more jobs matching my profile",
    icon: <Search className="h-3 w-3" />,
  },
];

const AFTER_RESUME_CHIPS: Chip[] = [
  {
    label: "Tailor for a job",
    message: "Tailor my resume for a specific job I'm applying to",
  },
  {
    label: "Find jobs",
    message: "Search for jobs matching my profile and skills",
    icon: <Search className="h-3 w-3" />,
  },
  {
    label: "My applications",
    message: "Show me my application board",
    icon: <Briefcase className="h-3 w-3" />,
  },
];

const AFTER_PREP_CHIPS: Chip[] = [
  {
    label: "Practice questions",
    message: "Let's practice — ask me the first question",
    icon: <MessageSquare className="h-3 w-3" />,
  },
  {
    label: "View my answers",
    message: "Search my answer library for relevant answers",
  },
  {
    label: "Back to pipeline",
    message: "Show my applications",
    icon: <Briefcase className="h-3 w-3" />,
  },
];

const AFTER_PRACTICE_CHIPS: Chip[] = [
  {
    label: "Next question",
    message: "Ask me the next practice question",
    icon: <MessageSquare className="h-3 w-3" />,
  },
  {
    label: "Try that again",
    message: "Let me try that question again",
  },
  {
    label: "End practice",
    message: "Summarize my practice session",
  },
];

const AFTER_EMAIL_CHIPS: Chip[] = [
  {
    label: "Another follow-up",
    message: "Draft a follow-up email for another application",
    icon: <Mail className="h-3 w-3" />,
  },
  {
    label: "Find new jobs",
    message: "Search for jobs matching my profile",
    icon: <Search className="h-3 w-3" />,
  },
  {
    label: "View pipeline",
    message: "Show me my application board",
    icon: <Briefcase className="h-3 w-3" />,
  },
];

const WEEKLY_REVIEW_CHIPS: Chip[] = [
  {
    label: "Check stale apps",
    message: "Show applications with no updates in the past week",
    icon: <Briefcase className="h-3 w-3" />,
  },
  {
    label: "Find new jobs",
    message: "Search for new jobs matching my profile",
    icon: <Search className="h-3 w-3" />,
  },
  {
    label: "View pipeline",
    message: "Show my application board",
    icon: <Kanban className="h-3 w-3" />,
  },
];

function getChips(lastTool: LastTool, flowContext?: FlowContext): Chip[] {
  // Flow-aware chips take priority when an active flow is detected
  if (flowContext?.activeFlow) {
    if (flowContext.activeFlow === 'discovery') {
      if (lastTool === 'searchJobs') return AFTER_JOBS_CHIPS;
      if (lastTool === 'prepareApplication') return AFTER_PACKAGE_CHIPS;
    }

    if (flowContext.activeFlow === 'interview_prep') {
      if (lastTool === 'showInterviewPrep') return AFTER_PREP_CHIPS;
      if (lastTool === 'practiceInterviewQuestion') return AFTER_PRACTICE_CHIPS;
    }

    if (flowContext.activeFlow === 'weekly_review') {
      if (lastTool === 'getWeeklyStats') return WEEKLY_REVIEW_CHIPS;
    }

    if (flowContext.activeFlow === 'email_followup') {
      if (lastTool === 'draftFollowUpEmail') return AFTER_EMAIL_CHIPS;
    }
  }

  // Fall back to tool-based chips
  switch (lastTool) {
    case "searchJobs":
      return AFTER_JOBS_CHIPS;
    case "prepareApplication":
      return AFTER_PACKAGE_CHIPS;
    case "getProfileSummary":
      return AFTER_PROFILE_CHIPS;
    case "showApplicationBoard":
    case "getApplicationStatus":
      return AFTER_BOARD_CHIPS;
    case "showResumePreview":
      return AFTER_RESUME_CHIPS;
    case "showInterviewPrep":
      return AFTER_PREP_CHIPS;
    case "practiceInterviewQuestion":
      return AFTER_PRACTICE_CHIPS;
    case "draftFollowUpEmail":
      return AFTER_EMAIL_CHIPS;
    case "getWeeklyStats":
      return WEEKLY_REVIEW_CHIPS;
    default:
      return DEFAULT_CHIPS;
  }
}

interface Props {
  lastTool: LastTool;
  flowContext?: FlowContext;
  onSelect: (message: string) => void;
  disabled?: boolean;
}

export function QuickActionChips({ lastTool, flowContext, onSelect, disabled }: Props) {
  const chips = getChips(lastTool, flowContext);

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {chips.map((chip) => (
        <Button
          key={chip.label}
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 rounded-full"
          disabled={disabled}
          onClick={() => {
            trackInteraction({
              interactionType: "chip_click",
              actionText: chip.label,
              actionMessage: chip.message,
            });
            onSelect(chip.message);
          }}
        >
          {chip.icon}
          {chip.label}
        </Button>
      ))}
    </div>
  );
}
