'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface SessionSummaryProps {
  summary: string;
  extractedItemCount: number;
  topicLabel: string;
  onStartAnother: () => void;
  onGenerateProfile: () => void;
  onReviewItems: () => void;
}

export function SessionSummary({
  summary,
  extractedItemCount,
  topicLabel,
  onStartAnother,
  onGenerateProfile,
  onReviewItems,
}: SessionSummaryProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateProfile = async () => {
    setIsGenerating(true);
    try {
      await onGenerateProfile();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto p-8">
      <div className="space-y-6">
        {/* Success Icon and Header */}
        <div className="text-center space-y-3">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Session Complete</h2>
            <p className="text-lg text-gray-600 mt-1">{topicLabel}</p>
          </div>
        </div>

        {/* Summary Text */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-gray-700 leading-relaxed">{summary}</p>
        </div>

        {/* Stats */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-blue-900 font-medium text-center">
            {extractedItemCount} knowledge items extracted
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-3 pt-2">
          {/* Primary Button */}
          <Button
            onClick={handleGenerateProfile}
            disabled={isGenerating}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isGenerating ? 'Generating...' : 'Generate Profile Summary'}
          </Button>

          {/* Secondary Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={onReviewItems}
              variant="outline"
              className="w-full"
            >
              Review Extracted Items
            </Button>
            <Button
              onClick={onStartAnother}
              variant="outline"
              className="w-full"
            >
              Start Another Topic
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}