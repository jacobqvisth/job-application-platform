'use client'

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

function DotsProgress({ score }: { score: number }) {
  const filled = Math.round(score * 4)
  const color =
    filled <= 1 ? 'bg-red-300' : filled === 2 ? 'bg-amber-400' : 'bg-emerald-500'

  return (
    <div className="flex gap-0.5">
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          className={`h-1.5 w-4 rounded-full ${i < filled ? color : 'bg-muted'}`}
        />
      ))}
    </div>
  )
}

export function CategoryCompleteness({ counts }: CategoryCompletenessProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CATEGORY_CONFIG.map(({ key, label, threshold, icon }) => {
        const count = counts[key] ?? 0
        const score = Math.min(count / threshold, 1.0)

        return (
          <div
            key={key}
            className="flex flex-col gap-2 rounded-lg border bg-card p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm">{icon}</span>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {count}
              </span>
            </div>
            <p className="text-xs font-medium leading-tight">{label}</p>
            <DotsProgress score={score} />
          </div>
        )
      })}
    </div>
  )
}
