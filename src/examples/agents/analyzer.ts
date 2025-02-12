import { z } from 'zod';
import { createAgent } from '../../core/agent';
import { createTask } from '../../core/task';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { Tool } from 'ai';

// Define analysis tools
const analyzerTools = {
  countWords: {
    description: 'Count the number of words in a text',
    parameters: z.object({
      text: z.string()
    }),
    execute: async ({ text }) => {
      const words = text.trim().split(/\s+/).length;
      return {
        content: [{
          type: 'text',
          text: `${words}`
        }]
      };
    }
  } as Tool,

  detectSentiment: {
    description: 'Detect the sentiment of a text (positive, neutral, or negative)',
    parameters: z.object({
      text: z.string()
    }),
    execute: async ({ text }) => {
      // This is a simplified example. In a real implementation,
      // you would use a proper sentiment analysis library
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'benefits'];
      const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'concerns', 'risks'];
      
      const lowerText = text.toLowerCase();
      const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
      const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

      let sentiment = 'neutral';
      if (positiveCount > negativeCount) {sentiment = 'positive';}
      if (negativeCount > positiveCount) {sentiment = 'negative';}

      return {
        content: [{
          type: 'text',
          text: sentiment
        }]
      };
    }
  } as Tool,

  calculateComplexity: {
    description: 'Calculate text complexity score and level',
    parameters: z.object({
      text: z.string()
    }),
    execute: async ({ text }) => {
      // This is a simplified example. In a real implementation,
      // you would use more sophisticated metrics
      const words = text.trim().split(/\s+/);
      const avgWordLength = words.reduce((sum: number, word: string) => sum + word.length, 0) / words.length;
      const sentences = text.split(/[.!?]+/).filter(Boolean);
      const avgSentenceLength = words.length / sentences.length;

      // Calculate complexity score (0-10)
      const score = Math.min(10, Math.round((avgWordLength * 1.5 + avgSentenceLength * 0.5) - 3));
      
      // Determine level
      let level = 'basic';
      if (score >= 7) {level = 'advanced';}
      else if (score >= 4) {level = 'intermediate';}

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ score, level })
        }]
      };
    }
  } as Tool
};

// Initialize OpenRouter
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

// Create analyzer agent with tools
export const analyzerAgent = createAgent({
  name: 'Text Analyzer',
  description: 'An agent that analyzes text content and provides detailed insights',
  role: 'You are a text analysis expert who provides detailed insights about text content. Always use the provided tools for analysis.',
  model: openrouter.chat('anthropic/claude-3-opus-20240229'),
  tools: analyzerTools
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
    name: 'Analyze Text',
    description: 'Analyzes text content and provides structured insights',
    agent: analyzerAgent,
    schema: analysisSchema,
    task: (input: { text: string }) => `
Analyze this text using the provided tools:
${input.text}

1. Use the countWords tool to get the word count
2. Use the detectSentiment tool to determine the sentiment
3. Use the calculateComplexity tool to assess text complexity
4. Identify the main themes and write a brief summary

Return the following information:
- wordCount: (use countWords tool result)
- sentiment: (use detectSentiment tool result)
- complexity: (use calculateComplexity tool result)
- summary: (your brief summary of the text)
- topThemes: (list of main themes you identified)
`
  })
}; 