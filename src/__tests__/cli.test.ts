import { jest } from '@jest/globals';
import { Agent } from '../core/agent';
import { Command } from 'commander';
import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { program, main } from '../cli';

type TaskOptions = {
  stream?: boolean;
};

type TaskFunction = (task: string, options?: TaskOptions) => Promise<string> | AsyncGenerator<string, void, unknown>;

// Mock dependencies
jest.mock('@inquirer/prompts', () => ({
  input: jest.fn(),
  select: jest.fn()
}));
jest.mock('../core/agent');
jest.mock('../lib/tools/play-audio');
jest.mock('../server');

// Mock process.exit to prevent tests from actually exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
  throw new Error(`Process.exit called with code: ${code}`);
});

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
const mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

describe('CLI', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalArgv: string[];
  
  beforeEach(() => {
    // Save original environment and argv
    originalEnv = { ...process.env };
    originalArgv = [...process.argv];
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset process.argv
    process.argv = ['node', 'cli.js'];
  });
  
  afterEach(() => {
    // Restore original environment and argv
    process.env = originalEnv;
    process.argv = originalArgv;
  });
  
  describe('API Key Handling', () => {
    it('should throw error if no API key is provided', async () => {
      // Remove any existing API keys
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      process.argv.push('test task');
      
      await main('test task');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error: API key required')
      );
    });
  });
  
  describe('Task Execution', () => {
    beforeEach(() => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      
      // Mock Agent implementation
      const MockAgent = (jest.requireMock('../core/agent') as { Agent: jest.Mock }).Agent;
      MockAgent.mockImplementation(() => ({
        task: jest.fn(async (task: string, options?: TaskOptions) => {
          if (options?.stream) {
            return {
              [Symbol.asyncIterator]: async function* () {
                yield 'Task completed successfully';
              }
            };
          }
          return 'Task completed successfully';
        })
      }));
    });
    
    it('should execute task in normal mode with streaming (default)', async () => {
      program.parse(['node', 'cli.js', 'test task', '--no-sound']);
      const task = program.args[0];
      
      await main(task);
      
      expect(mockStdoutWrite).toHaveBeenCalledWith('Task completed successfully');
    });
    
    it('should execute task in non-streaming mode', async () => {
      program.parse(['node', 'cli.js', '--no-stream', 'test task', '--no-sound']);
      const task = program.args[0];
      
      await main(task);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Executing task: test task')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith('Task completed successfully');
    });
  });
  
  describe('Interactive Mode', () => {
    beforeEach(() => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      
      // Mock Agent implementation
      const MockAgent = (jest.requireMock('../core/agent') as { Agent: jest.Mock }).Agent;
      MockAgent.mockImplementation(() => ({
        task: jest.fn(async (task: string, options?: TaskOptions) => {
          if (options?.stream) {
            return {
              [Symbol.asyncIterator]: async function* () {
                yield 'Task completed successfully';
              }
            };
          }
          return 'Task completed successfully';
        })
      }));
    });
    
    it('should handle interactive mode', async () => {
      program.parse(['node', 'cli.js', '-i']);
      const task = program.args[0];
      
      jest.mocked(input).mockResolvedValueOnce('test task').mockResolvedValueOnce('exit');
      
      await main(task);
      
      expect(input).toHaveBeenCalled();
      expect(mockStdoutWrite).toHaveBeenCalledWith('Task completed successfully');
    });
    
    it('should exit interactive mode when "exit" is entered', async () => {
      program.parse(['node', 'cli.js', '-i']);
      const task = program.args[0];
      
      jest.mocked(input).mockResolvedValueOnce('exit');
      
      const result = await main(task);
      expect(result).toBe(0);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Exiting interactive mode')
      );
    });
  });
  
  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.OPENROUTER_API_KEY = 'test-key';
    });
    
    it('should handle agent errors gracefully', async () => {
      program.parse(['node', 'cli.js', 'test task']);
      const task = program.args[0];
      
      const error = new Error('Agent error');
      const MockAgent = (jest.requireMock('../core/agent') as { Agent: jest.Mock }).Agent;
      MockAgent.mockImplementation(() => ({
        task: jest.fn().mockImplementation(() => Promise.reject(error))
      }));
      
      const result = await main(task);
      expect(result).toBe(1);
      
      const calls = mockConsoleError.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toBe(chalk.red('Error executing task:'));
      expect(calls[0][1]).toBe(error);
    });
  });
}); 