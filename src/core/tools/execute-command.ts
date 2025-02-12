import { Tool } from 'ai';
import { z } from 'zod';
import { spawn } from 'child_process';

export const executeCommandTool: Tool = {
  description: "Execute a CLI command on the system. Commands will be executed in the current working directory.",
  parameters: z.object({
    command: z.string().describe('The CLI command to execute. This should be valid for the current operating system.')
  }),
  execute: async ({ command }) => {
    return new Promise((resolve) => {
      const childProcess = spawn(command, [], {
        shell: true,
        cwd: process.cwd()
      });

      let output = '';
      let error = '';

      childProcess.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        // Log output in real-time for better feedback
        console.log(text);
      });

      childProcess.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        error += text;
        // Log errors in real-time for better feedback
        console.error(text);
      });

      childProcess.on('close', (code: number | null) => {
        if (code !== 0) {
          resolve({
            isError: true,
            content: [{
              type: "text",
              text: error || `Command failed with code ${code}`
            }]
          });
        } else {
          resolve({
            content: [{
              type: "text",
              text: output || 'Command completed successfully with no output'
            }]
          });
        }
      });

      childProcess.on('error', (err: Error) => {
        resolve({
          isError: true,
          content: [{
            type: "text",
            text: `Failed to execute command: ${err.message}`
          }]
        });
      });
    });
  }
};