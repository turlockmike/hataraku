import { Tool } from 'ai';
import { z } from 'zod';
import * as path from 'path';
import { listFiles } from '../../services/glob/list-files';

export const listFilesTool: Tool = {
  description: "List files and directories within the specified directory. If recursive is true, it lists all files (with relative paths) recursively.",
  parameters: z.object({
    path: z.string().describe('The path of the directory to list contents for (relative to the current working directory)'),
    recursive: z.boolean().optional().describe('Set to true for a recursive listing, false or omitted for top-level only.')
  }),
  execute: async ({ path: dirPath, recursive = false }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), dirPath);
      const [files, hasMore] = await listFiles(absolutePath, recursive, 1000);
      
      // Convert absolute paths to relative paths
      const relativePaths = files.map(file => {
        const relPath = path.relative(absolutePath, file);
        // Remove trailing slash from directories and normalize path separators
        return relPath.replace(/[\\/]+$/, '').split(path.sep).join('/');
      });

      const message = relativePaths.length > 0 
        ? relativePaths.sort().join('\n') 
        : '(empty directory)';

      return {
        content: [{
          type: "text",
          text: hasMore ? `${message}\n(showing first 1000 entries)` : message
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error listing files: ${errorMessage}`
        }]
      };
    }
  }
};