import { Badge } from "@/components/ui/badge";
import type { AnswerCategory } from "@/lib/types/database";

const CATEGORY_STYLES: Record<AnswerCategory, string> = {
  behavioral: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  technical: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  motivational: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  situational: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  salary: "bg-green-100 text-green-800 hover:bg-green-100",
  availability: "bg-teal-100 text-teal-800 hover:bg-teal-100",
  why_us: "bg-pink-100 text-pink-800 hover:bg-pink-100",
  why_role: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
  other: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
};

const CATEGORY_LABELS: Record<AnswerCategory, string> = {
  behavioral: "Behavioral",
  technical: "Technical",
  motivational: "Motivational",
  situational: "Situational",
  salary: "Salary",
  availability: "Availability",
  why_us: "Why Us",
  why_role: "Why Role",
  other: "Other",
};

interface CategoryBadgeProps {
  category: AnswerCategory;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={`${CATEGORY_STYLES[category]} border-0 font-medium ${className ?? ""}`}
    >
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}

export { CATEGORY_LABELS };
