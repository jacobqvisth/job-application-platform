'use client';

import { useState } from 'react';
import { ChevronDown, RefreshCw, Diamond } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateProfileSummaryAction } from '@/app/(protected)/dashboard/knowledge/interview/actions';
import Link from 'next/link';

interface ProfileSummaryCardProps {
  summary: {
    executive_summary: string | null;
    key_strengths: string[];
    career_narrative: string | null;
    leadership_style: string | null;
    ideal_role_description: string | null;
    unique_value_proposition: string | null;
    last_generated_at: string | null;
  } | null;
}

export function ProfileSummaryCard({ summary }: ProfileSummaryCardProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    try {
      await generateProfileSummaryAction();
    } finally {
      setIsGenerating(false);
    }
  };

  if (!summary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <h3 className="text-lg font-semibold mb-2">
              Generate your professional identity summary
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload documents or complete at least one interview first
            </p>
            <Link href="/dashboard/knowledge/interview">
              <Button variant="outline">Go to interviews</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const executiveSummaryPreview = summary.executive_summary
    ? summary.executive_summary.split('\n')[0]
    : null;

  const lastUpdatedDate = summary.last_generated_at
    ? new Date(summary.last_generated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle>Professional Identity Summary</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerate}
            disabled={isGenerating}
          >
            <RefreshCw
              className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Executive Summary */}
        {executiveSummaryPreview && (
          <div>
            <h3 className="font-semibold text-sm mb-2">Executive Summary</h3>
            <p className="text-sm text-gray-700 line-clamp-3">
              {executiveSummaryPreview}
            </p>
          </div>
        )}

        {/* Key Strengths */}
        {summary.key_strengths && summary.key_strengths.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-2">Key Strengths</h3>
            <div className="flex flex-wrap gap-2">
              {summary.key_strengths.map((strength) => (
                <Badge key={strength} variant="secondary">
                  {strength}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Unique Value Proposition */}
        {summary.unique_value_proposition && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Diamond className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm text-purple-900 mb-1">
                  Unique Value Proposition
                </h3>
                <p className="text-sm text-purple-800">
                  {summary.unique_value_proposition}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Expandable Sections */}
        {summary.career_narrative && (
          <ExpandableSection
            title="Full Career Narrative"
            content={summary.career_narrative}
            isExpanded={expandedSections['narrative']}
            onToggle={() => toggleSection('narrative')}
          />
        )}

        {summary.leadership_style && (
          <ExpandableSection
            title="Leadership Style"
            content={summary.leadership_style}
            isExpanded={expandedSections['leadership']}
            onToggle={() => toggleSection('leadership')}
          />
        )}

        {summary.ideal_role_description && (
          <ExpandableSection
            title="Ideal Role"
            content={summary.ideal_role_description}
            isExpanded={expandedSections['idealRole']}
            onToggle={() => toggleSection('idealRole')}
          />
        )}

        {/* Footer */}
        {lastUpdatedDate && (
          <div className="text-xs text-gray-500 border-t pt-4">
            Last updated: {lastUpdatedDate}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ExpandableSectionProps {
  title: string;
  content: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function ExpandableSection({
  title,
  content,
  isExpanded,
  onToggle,
}: ExpandableSectionProps) {
  return (
    <div className="border rounded-lg">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <h3 className="font-semibold text-sm">{title}</h3>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}