import { MockLanguageModelV1 } from 'ai/test';
import { createCLIAgent } from '../../agents/cli-agent';
import * as os from 'node:os';
import { readdirSync } from 'node:fs';

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
        // Mock process values
        process.cwd = jest.fn().mockReturnValue(mockCwd);
        process.env.TERM_PROGRAM = undefined;

        // Mock Date to ensure consistent timestamp
        const mockDate = new Date('2025-02-19T20:18:28.000Z'); // UTC time matching CI
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
        
        // Set timezone to UTC
        process.env.TZ = 'UTC';

        // Mock Intl.DateTimeFormat to ensure consistent locale and timezone
        const mockDateTimeFormat = {
            resolvedOptions: () => ({
                locale: 'en-US',
                timeZone: 'UTC',
                calendar: 'gregory',
                numberingSystem: 'latn'
            }),
            format: jest.fn(),
            formatToParts: jest.fn(),
            formatRange: jest.fn(),
            formatRangeToParts: jest.fn()
        };
        global.Intl.DateTimeFormat = Object.assign(jest.fn(() => mockDateTimeFormat), {
            supportedLocalesOf: jest.fn()
        });

        // Setup mock return values to match GitHub Actions environment
        (os.homedir as jest.Mock).mockReturnValue(mockHomedir);
        (os.platform as jest.Mock).mockReturnValue('linux');
        (os.release as jest.Mock).mockReturnValue('6.8.0-1021-azure');
        (os.arch as jest.Mock).mockReturnValue('x64');
        (os.cpus as jest.Mock).mockReturnValue(Array(4).fill({})); // 4 CPUs
        (os.totalmem as jest.Mock).mockReturnValue(17179869184); // 16GB
        (os.freemem as jest.Mock).mockReturnValue(15032385536); // 14GB
        (os.userInfo as jest.Mock).mockReturnValue({ username: 'runner' });
        (readdirSync as jest.Mock).mockReturnValue([
            '.changeset', '.cursor', '.eslintrc.json', '.git', '.gitattributes', 
            '.github', '.gitignore', '.husky', '.npmrc', '.nvmrc', '.prettierignore', 
            '.prettierrc.json', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE', 'README.md', 
            'docs', 'esbuild.js', 'jest.config.cjs', 'node_modules', 'package-lock.json', 
            'package.json', 'src', 'tsconfig.cjs.json', 'tsconfig.esm.json', 'tsconfig.json'
        ]);

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