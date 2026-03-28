import { createClient } from '@/lib/supabase/server'
import type { KnowledgeItem } from '@/lib/data/knowledge'

/**
 * Get knowledge items relevant to a job description.
 * Returns a formatted string ready for prompt injection.
 */
export async function getRelevantKnowledgeContext(
  userId: string,
  jobDescription: string | null
): Promise<string> {
  const supabase = await createClient()

  // Fetch all active, confirmed knowledge items
  const { data: items } = await supabase
    .from('knowledge_items')
    .select('category, title, content, tags')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('confidence', ['user_confirmed', 'ai_inferred'])
    .order('category')

  if (!items || items.length === 0) return ''

  // Group by category and format
  const grouped: Record<string, string[]> = {}
  for (const item of items as Pick<KnowledgeItem, 'category' | 'title' | 'content' | 'tags'>[]) {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push(`${item.title}: ${item.content.slice(0, 200)}`)
  }

  const sections: string[] = []
  const categoryLabels: Record<string, string> = {
    achievement: 'Key Achievements',
    story: 'Behavioral Stories (use these for STAR-format answers)',
    skill: 'Skills & Expertise',
    value: 'Values & What Drives Them',
    philosophy: 'Work Philosophy',
    preference: 'Role Preferences',
    self_assessment: 'Self-Assessment',
    fact: 'Career Facts',
  }

  const priorityOrder = ['story', 'achievement', 'value', 'skill', 'philosophy', 'preference', 'self_assessment', 'fact']

  for (const cat of priorityOrder) {
    if (grouped[cat]?.length) {
      const label = categoryLabels[cat] || cat
      const itemsToInclude = grouped[cat].slice(0, 5)
      sections.push(`${label}:\n${itemsToInclude.map(i => `- ${i}`).join('\n')}`)
    }
  }

  if (sections.length === 0) return ''

  return `\n\nDeep knowledge about this candidate (use this to make the application authentic and specific):\n${sections.join('\n\n')}`
}
