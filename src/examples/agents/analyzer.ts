import { z } from 'zod';
import { createAgent } from '../../core/agent';
import { createTask } from '../../core/task';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// Initialize OpenRouter
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

// Create analyzer agent
const analyzerAgent = createAgent({
  role: 'You are a text analysis expert who provides detailed insights about text content.',
  model: openrouter.chat('anthropic/claude-3-opus-20240229'),
  name: 'Analyzer Agent',
  description: 'Analyzes text content and provides detailed insights'
});

// Define analysis result schema
export const analysisSchema = z.object({
  wordCount: z.number(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  topThemes: z.array(z.string()),
  complexity: z.object({
    level: z.enum(['basic', 'intermediate', 'advanced']),
    score: z.number().min(0).max(10),
  }),
  summary: z.string(),
});

// Export the analysis result type
export type AnalysisResult = z.infer<typeof analysisSchema>;

// Create analyzer tasks
export const analyzerTasks = {
  analyze: createTask({
    agent: analyzerAgent,
    name: 'analyze',
    description: 'Analyze text content and provide structured insights',
    schema: analysisSchema,
    task: (input: { text: string }) => `Please analyze the following text and provide structured insights:

Text: ${input.text}

Provide your analysis in the following JSON format:
{
  "wordCount": number of words in the text,
  "sentiment": overall sentiment ("positive", "neutral", or "negative"),
  "topThemes": array of main themes/topics discussed,
  "complexity": {
    "level": text complexity level ("basic", "intermediate", or "advanced"),
    "score": complexity score from 0-10
  },
  "summary": brief 1-2 sentence summary of the text
}`
  })
}; 