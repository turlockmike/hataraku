import { createBedrockProvider } from '../../core/providers/bedrock';

// Helper to create a Bedrock chat completion
export const createBedrockChat = async (profile: string = 'default') => {
  const bedrock = await createBedrockProvider(profile);
  return bedrock('anthropic.claude-3-sonnet-20240229-v1:0');
}; 