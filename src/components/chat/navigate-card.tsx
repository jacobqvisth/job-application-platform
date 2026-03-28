"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { NavigateData } from "@/lib/chat/types";

interface Props {
  data: NavigateData;
}

export function NavigateCard({ data }: Props) {
  const router = useRouter();

  const handleNavigate = () => {
    router.push(data.url);
  };

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3 w-full max-w-sm">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{data.pageName}</p>
        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{data.description}</p>
      </div>
      <button
        onClick={handleNavigate}
        className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-[oklch(0.44_0.19_265)] hover:underline"
      >
        Open
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}
