import { Badge } from "@/components/ui/badge";
import type { AnswerCategory } from "@/lib/types/database";

const CATEGORY_STYLES: Record<AnswerCategory, string> = {
  behavioral:   "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100",
  technical:    "bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100",
  motivational: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  situational:  "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100",
  salary:       "bg-green-100 text-green-700 border-green-200 hover:bg-green-100",
  availability: "bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100",
  why_us:       "bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-100",
  why_role:     "bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
  other:        "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100",
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
      variant="outline"
      className={`${CATEGORY_STYLES[category]} font-medium ${className ?? ""}`}
    >
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}

export { CATEGORY_LABELS };
