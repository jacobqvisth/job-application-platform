import type { UserProfileData } from '@/lib/types/database';

interface JobForScoring {
  title: string;
  description: string;
}

export function computeMatchScore(
  job: JobForScoring,
  profile: UserProfileData | null
): number {
  if (!profile) return 0;

  const jobText = `${job.title} ${job.description}`.toLowerCase();
  let score = 0;

  // Skill overlap (up to 50 points)
  // profile.skills is SkillCategory[] — flatten to individual skill strings
  const skills: string[] = (profile.skills || []).flatMap((cat) =>
    cat.skills.map((s) => s.toLowerCase())
  );

  if (skills.length > 0) {
    const matched = skills.filter((skill) => jobText.includes(skill));
    score += Math.round((matched.length / skills.length) * 50);
  }

  // Job title similarity (up to 30 points)
  const pastTitles: string[] = (profile.work_history || [])
    .map((w) => w.title?.toLowerCase() || '')
    .filter(Boolean);

  const jobTitle = job.title.toLowerCase();
  const titleMatch = pastTitles.some(
    (t) =>
      jobText.includes(t) ||
      t.split(' ').some((word) => word.length > 4 && jobTitle.includes(word))
  );
  if (titleMatch) score += 30;

  // Summary keyword overlap (up to 20 points)
  if (profile.summary) {
    const summaryWords = profile.summary
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 5);
    const summaryMatched = summaryWords.filter((word) => jobText.includes(word));
    score += Math.min(
      20,
      Math.round((summaryMatched.length / Math.max(summaryWords.length, 1)) * 40)
    );
  }

  return Math.min(100, score);
}
