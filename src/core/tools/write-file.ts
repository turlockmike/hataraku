import { Tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

export const writeFileTool: Tool = {
  description: "Write content to a file at the specified path. Creates directories if they don't exist. If the file exists, it will be overwritten.",
  parameters: z.object({
    path: z.string().describe('The path of the file to write to (relative to the current working directory)'),
    content: z.string().describe('The content to write to the file. ALWAYS provide the COMPLETE intended content of the file.'),
    line_count: z.number().int().min(0).describe('The number of lines in the file')
  }),
  execute: async ({ path: filePath, content, line_count }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      
      // Validate line count matches content
      const actualLineCount = content.split('\n').length;
      if (line_count !== 0 && actualLineCount !== line_count) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Line count mismatch: expected ${line_count} but content has ${actualLineCount} lines`
          }]
        };
      }

      // Check if file exists before writing
      const fileExists = await fs.access(absolutePath).then(() => true, () => false);

      // Create directories if they don't exist
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      
      // Write the file
      await fs.writeFile(absolutePath, content, 'utf-8');
      
      const action = fileExists ? 'updated' : 'created';
      return {
        content: [{
          type: "text",
          text: `File successfully ${action} at ${filePath}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error writing file: ${errorMessage}`
        }]
      };
    }
  }
};