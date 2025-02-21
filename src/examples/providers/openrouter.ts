import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// Helper to create an OpenRouter chat completion
export const createOpenRouterChat = (apiKey: string) => {
  const openrouter = createOpenRouter({ apiKey });
  return openrouter.chat('anthropic/claude-3-sonnet');
}; 