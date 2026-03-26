"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { CATEGORY_LABELS } from "./category-badge";
import type { AnswerCategory } from "@/lib/types/database";

const CATEGORIES: AnswerCategory[] = [
  "behavioral",
  "technical",
  "motivational",
  "situational",
  "salary",
  "availability",
  "why_us",
  "why_role",
  "other",
];

interface AnswerFiltersProps {
  category: string;
  rating: string;
  search: string;
  onCategoryChange: (value: string) => void;
  onRatingChange: (value: string) => void;
  onSearchChange: (value: string) => void;
}

export function AnswerFilters({
  category,
  rating,
  search,
  onCategoryChange,
  onRatingChange,
  onSearchChange,
}: AnswerFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search questions and answers..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {CATEGORIES.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={rating} onValueChange={onRatingChange}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="All ratings" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All ratings</SelectItem>
          <SelectItem value="strong">Strong</SelectItem>
          <SelectItem value="good">Good</SelectItem>
          <SelectItem value="needs_work">Needs Work</SelectItem>
          <SelectItem value="untested">Untested</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
