import type {
  ITopicBlock, ITopicExample, ITopicCommonMistake, ITopicInterviewTip,
  ITopicPractice, ITopicQuizQuestion, ITopicResource, TopicLevel, TopicSource,
} from '../../models/LearningTopic';

/**
 * AETHER Career Learning — seed topic content (spec §31, §40).
 *
 * Every topic below is originally written educational material: overview,
 * objectives, structured content blocks with real code, multiple worked
 * examples (simple → user input → real world → interview style), common
 * mistakes, interview relevance, tiered practice, a real quiz, and official
 * documentation links. No content is generated at request time.
 */
export interface SeedTopic {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  whyItMatters: string;
  interviewRelevance: string;
  group: string;
  order: number;
  level: TopicLevel;
  estimatedMinutes: number;
  skillSlugs: string[];
  roleSlugs: string[];
  roadmapNodeIds?: string[];
  courseSlugs?: string[];
  prerequisites: string[];
  optionalPrerequisites?: string[];
  learningObjectives: string[];
  sections: ITopicBlock[];
  examples: ITopicExample[];
  commonMistakes: ITopicCommonMistake[];
  interviewTips: ITopicInterviewTip[];
  practice: ITopicPractice[];
  quiz: ITopicQuizQuestion[];
  resources: ITopicResource[];
  nextTopicSlugs: string[];
  relatedTopicSlugs: string[];
  source?: TopicSource;
  reviewedBy?: string;
}

export type {
  ITopicBlock, ITopicExample, ITopicCommonMistake, ITopicInterviewTip,
  ITopicPractice, ITopicQuizQuestion, ITopicResource,
};
