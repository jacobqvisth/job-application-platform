'use client'

import Link from 'next/link'
import { KnowledgeCategory } from '@/lib/data/knowledge'

interface CategoryCompletenessProps {
  counts: Record<string, number>
}

const CATEGORY_CONFIG: {
  key: KnowledgeCategory
  label: string
  threshold: number
  icon: string
}[] = [
  { key: 'fact', label: 'Facts', threshold: 10, icon: '📋' },
  { key: 'skill', label: 'Skills', threshold: 8, icon: '⚡' },
  { key: 'achievement', label: 'Achievements', threshold: 5, icon: '🏆' },
  { key: 'story', label: 'Stories', threshold: 6, icon: '📖' },
  { key: 'value', label: 'Values', threshold: 3, icon: '💎' },
  { key: 'preference', label: 'Preferences', threshold: 5, icon: '🎯' },
  { key: 'philosophy', label: 'Philosophy', threshold: 2, icon: '🧭' },
  { key: 'self_assessment', label: 'Self-Assessment', threshold: 3, icon: '🔍' },
]

function progressColor(score: number): string {
  if (score >= 0.8) return '#22c55e'
  if (score >= 0.4) return '#f59e0b'
  return '#ef4444'
}

function CircleProgress({ score }: { score: number }) {
  const r = 14
  const circ = 2 * Math.PI * r
  const color = progressColor(score)
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle
        cx="18" cy="18" r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={`${score * circ} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CategoryCompleteness({ counts }: CategoryCompletenessProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CATEGORY_CONFIG.map(({ key, label, threshold, icon }) => {
        const count = counts[key] ?? 0
        const score = Math.min(count / threshold, 1.0)

        return (
          <Link
            key={key}
            href={`/dashboard/knowledge?category=${key}`}
            className="flex flex-col gap-2 rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm">{icon}</span>
              <div className="relative">
                <CircleProgress score={score} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums">
                  {count}
                </span>
              </div>
            </div>
            <p className="text-xs font-medium leading-tight">{label}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">{count}/{threshold}</p>
          </Link>
        )
      })}
    </div>
  )
}
