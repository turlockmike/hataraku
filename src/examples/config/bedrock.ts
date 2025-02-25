import { createBedrockProvider } from '../../core/providers/bedrock';

// Helper to create a Bedrock chat completion
export const createBedrockChat = async (profile: string = 'default') => {
  const bedrock = await createBedrockProvider(profile);
  return bedrock('us:anthropic.claude-3-7-sonnet-20250219-v1:0');
}; 