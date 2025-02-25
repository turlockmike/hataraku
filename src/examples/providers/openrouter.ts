import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// Helper to create an OpenRouter chat completion
export const createOpenRouterChat = (apiKey: string, model: string = 'anthropic/claude-3.7-sonnet') => {
  const openrouter = createOpenRouter({ apiKey });
  return openrouter.chat(model);
}; 