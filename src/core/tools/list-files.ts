import { Tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

async function readDirRecursive(dir: string, recursive: boolean): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory() && recursive) {
      files.push(...await readDirRecursive(res, recursive));
    } else {
      files.push(path.relative(process.cwd(), res));
    }
  }
  
  return files;
}

export const listFilesTool: Tool = {
  description: "List files and directories within the specified directory. If recursive is true, it will list all files and directories recursively.",
  parameters: z.object({
    path: z.string().describe('The path of the directory to list contents for (relative to the current working directory)'),
    recursive: z.boolean().optional().describe('Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.')
  }),
  execute: async ({ path: dirPath, recursive = false }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), dirPath);
      
      // Check if directory exists
      try {
        const stats = await fs.stat(absolutePath);
        if (!stats.isDirectory()) {
          return {
            isError: true,
            content: [{
              type: "text",
              text: `Path is not a directory: ${dirPath}`
            }]
          };
        }
      } catch {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Directory not found: ${dirPath}`
          }]
        };
      }

      // List files
      const files = await readDirRecursive(absolutePath, recursive);
      const fileList = files.join('\n');

      return {
        content: [{
          type: "text",
          text: fileList || '(empty directory)'
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error listing files: ${error.message}`
        }]
      };
    }
  }
};