import { MockLanguageModelV1 } from 'ai/test';
import { createCLIAgent } from '../../agents/cli-agent';

// Add mock for environment details at the top of the file
jest.mock('../../prompts/environment', () => ({
  getEnvironmentInfo: () => `<environment_details>
Environment Information: static testing info
</environment_details>`
}));

// Mock sound-play
jest.mock('sound-play', () => ({
    play: jest.fn()
}));

// Mock the fs module
jest.mock('node:fs', () => ({
    readdirSync: jest.fn()
}));

// Mock os module
jest.mock('node:os', () => ({
    ...jest.requireActual('node:os'),
    homedir: jest.fn(),
    platform: jest.fn(),
    release: jest.fn(),
    arch: jest.fn(),
    cpus: jest.fn(),
    totalmem: jest.fn(),
    freemem: jest.fn(),
    userInfo: jest.fn()
}));

// Mock child_process
jest.mock('child_process', () => ({
    execSync: jest.fn().mockReturnValue(Buffer.from('HEAD'))
}));

describe('CLI Agent', () => {
    const mockCwd = '/home/runner/work/hataraku/hataraku';
    const mockHomedir = '/home/runner';

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
        
        // Create a stable version of the agent for snapshot
        const stableAgent = {
            ...agent,
            modelPromise: expect.any(Promise)
        };
        
        (expect(stableAgent) as any).toMatchSnapshot({
            tools: expect.any(Object),
            taskHistory: {
                historyDir: expect.stringMatching(/^.*\/\.local\/share\/hataraku\/logs$/)
            }
        });

        // Clean up mocks
        jest.restoreAllMocks();
    });
}); 