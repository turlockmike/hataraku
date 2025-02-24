import { program, main } from '../cli'; // adjust the path as needed


// --- Mocks for dependencies used in the CLI ---
jest.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: jest.fn(() => ({
    chat: jest.fn().mockReturnValue({
      task: jest.fn().mockResolvedValue('mocked openrouter result'),
    }),
  })),
}));

jest.mock('../core/providers/bedrock', () => ({
  createBedrockProvider: jest.fn().mockResolvedValue(
    jest.fn().mockReturnValue({
      task: jest.fn().mockResolvedValue('mocked bedrock result'),
    })
  ),
}));

jest.mock('../core/agents', () => ({
  createCLIAgent: jest.fn(() => ({
    task: jest.fn().mockResolvedValue('agent result'),
  })),
}));

jest.mock('../core/tools/play-audio', () => ({
  playAudioTool: {
    execute: jest.fn().mockResolvedValue('mocked play audio result'),
  },
}));

jest.mock('@inquirer/prompts', () => ({
  input: jest.fn().mockResolvedValue('interactive task'),
}));

// const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
//   throw new Error(`Process.exit called with code: ${code}`);
// });

// --- Import the CLI module under test ---


// --- Begin tests ---
describe('CLI Input Parameters', () => {
  let mockExit: jest.SpyInstance;
  beforeEach(() => {
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
      throw new Error(`Process.exit called with code: ${code}`);
    });
    // Reset env vars before each test
    delete process.env.OPENROUTER_API_KEY;
    // Reset Commander options
    program.opts().provider = undefined;
    program.opts().model = undefined;
    program.opts().apiKey = undefined;
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  test('executes task in normal mode', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log');
    process.env.OPENROUTER_API_KEY = 'dummy';
    program.setOptionValue('provider', 'openrouter');
    const code = await main('myTask');
    console.log('DEBUG - Console output:', consoleLogSpy.mock.calls);
    expect(code).toBe(0);
    consoleLogSpy.mockRestore();
  });

  test('errors when API key is missing for non-Bedrock provider', async () => {
    program.setOptionValue('provider', 'openrouter');
    const code = await main('task');
    expect(code).toBe(1);
  });

  test('succeeds with Bedrock provider without API key', async () => {
    program.setOptionValue('provider', 'bedrock');
    const code = await main('task');
    expect(code).toBe(0);
  });

  test('errors when no task provided in non-interactive mode', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const code = await main();
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
