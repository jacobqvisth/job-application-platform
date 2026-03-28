'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, PlayCircle, CheckCircle2, Circle } from 'lucide-react';

interface Topic {
  key: string;
  label: string;
  description: string;
  icon: string;
  relatedCategories: string[];
}

interface Session {
  id: string;
  topic: string;
  topic_label: string | null;
  status: string;
  summary?: string | null;
  extracted_item_ids: string[];
  created_at: string;
  question_count: number;
}

interface TopicSelectorProps {
  topics: Topic[];
  sessions: Session[];
  categoryCounts: Record<string, number>;
  onSelectTopic: (key: string, label: string) => void;
  onResumeSession: (sessionId: string) => void;
}

export function TopicSelector({
  topics,
  sessions,
  categoryCounts,
  onSelectTopic,
  onResumeSession,
}: TopicSelectorProps) {
  // Calculate coverage score for each topic
  const getTopicCoverage = (topic: Topic): number => {
    return topic.relatedCategories.reduce(
      (sum, cat) => sum + (categoryCounts[cat] || 0),
      0
    );
  };

  // Get suggested topics (lowest coverage, 2-3 items)
  const suggestedTopics = topics
    .sort((a, b) => getTopicCoverage(a) - getTopicCoverage(b))
    .slice(0, 3);  // Get completed sessions
  const completedSessions = sessions.filter(s => s.status === 'completed');

  // Get topic status based on sessions
  const getTopicStatus = (topicKey: string): 'completed' | 'paused' | 'not-started' => {
    const topicSessions = sessions.filter(s => s.topic === topicKey);
    if (topicSessions.some(s => s.status === 'completed')) return 'completed';
    if (topicSessions.some(s => s.status === 'paused')) return 'paused';
    return 'not-started';
  };

  return (
    <div className="space-y-6">
      {/* Suggested Section */}
      {suggestedTopics.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Suggested Topics</h2>
          <div className="grid gap-2">
            {suggestedTopics.map(topic => (
              <Card
                key={topic.key}
                className="p-3 cursor-pointer hover:bg-purple-50 border-purple-200 hover:border-purple-300 transition-colors"
                onClick={() => onSelectTopic(topic.key, topic.label)}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{topic.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-gray-900">{topic.label}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2">{topic.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}      {/* All Topics Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">All Topics</h2>
        <div className="grid gap-2">
          {topics.map(topic => {
            const status = getTopicStatus(topic.key);
            const coverage = getTopicCoverage(topic);
            const isSuggested = suggestedTopics.find(t => t.key === topic.key);

            return (
              <Card
                key={topic.key}
                className={`p-3 transition-colors ${
                  status === 'not-started'
                    ? 'cursor-pointer hover:bg-purple-50 border-purple-200 hover:border-purple-300'
                    : 'bg-gray-50'
                }`}
                onClick={() => status === 'not-started' && onSelectTopic(topic.key, topic.label)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-lg mt-0.5">{topic.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm text-gray-900">{topic.label}</h3>
                        {isSuggested && (
                          <Badge variant="secondary" className="text-xs">
                            Suggested
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-1">{topic.description}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {status === 'completed' && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                    {status === 'paused' && <Circle className="h-5 w-5 text-yellow-500" />}
                    {status === 'not-started' && (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>      {/* Past Sessions Section */}
      {completedSessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Past Sessions</h2>
          <div className="grid gap-2">
            {completedSessions.map(session => (
              <Card
                key={session.id}
                className="p-3 cursor-pointer hover:bg-blue-50 border-blue-200 hover:border-blue-300 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-gray-900">
                        {session.topic_label}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {new Date(session.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {session.question_count} Q
                    </Badge>
                  </div>
                  {session.summary && (
                    <p className="text-xs text-gray-600 line-clamp-2">{session.summary}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    {session.extracted_item_ids.length} items extracted
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => onResumeSession(session.id)}
                  >
                    <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                    Review Session
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}