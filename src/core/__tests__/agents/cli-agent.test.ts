import { MockLanguageModelV1 } from 'ai/test';
import { createCLIAgent } from '../../agents/cli-agent';

// jest.mock('../../prompts', () => ({
//   getEnvironmentInfo: () => 'mocked environment info',
//   getAgentRules: () => 'mocked agent rules'
// }));

describe('CLI Agent', () => {
  it('should create CLI agent with correct configuration', () => {
    const mockModel = new MockLanguageModelV1({
      defaultObjectGenerationMode: 'json',
      doGenerate: async () => ({
        text: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} }
      })
    });

    const agent = createCLIAgent(mockModel);
    
    expect(agent).toMatchSnapshot({
      model: expect.any(MockLanguageModelV1),
      tools: expect.any(Object)
    });
  });
}); 