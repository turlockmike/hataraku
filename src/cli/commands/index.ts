import { Command } from 'commander';
import { registerProfileCommands } from './profile';
import { registerTaskCommands } from './task';
import { registerConfigCommands } from './config';

/**
 * Register all CLI commands with the program
 * @param program Commander program instance
 * @returns Program with all commands registered
 */
export function registerAllCommands(program: Command): Command {
  registerProfileCommands(program);
  registerTaskCommands(program);
  registerConfigCommands(program);
  
  return program;
}

export { registerProfileCommands, registerTaskCommands, registerConfigCommands };