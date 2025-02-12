import { Tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

async function searchInFile(filePath: string, regex: RegExp): Promise<string[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const matches: string[] = [];
  const contextLines = 2; // Number of lines before and after match

  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length, i + contextLines + 1);
      
      matches.push(
        `File: ${filePath}:${i + 1}`,
        '```',
        ...lines.slice(start, end).map((line, index) => 
          `${start + index + 1}${start + index === i ? ' >' : '  '} ${line}`
        ),
        '```\n'
      );
    }
  }
  
  return matches;
}

export const searchFilesTool: Tool = {
  description: "Search for patterns in files using regular expressions. Provides context around matches.",
  parameters: z.object({
    path: z.string().describe('The path of the directory to search in (relative to the current working directory)'),
    regex: z.string().describe('The regular expression pattern to search for'),
    file_pattern: z.string().optional().describe('Glob pattern to filter files (e.g., "*.ts" for TypeScript files)')
  }),
  execute: async ({ path: dirPath, regex, file_pattern }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), dirPath);
      
      // Validate regex
      try {
        new RegExp(regex);
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Invalid regular expression: ${error.message}`
          }]
        };
      }

      // Find files to search
      const pattern = path.join(absolutePath, file_pattern || '**/*');
      const files = glob.sync(pattern, {
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        nodir: true
      });

      if (files.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No files found matching pattern: ${file_pattern || '*'}`
          }]
        };
      }

      // Search in files
      const searchRegex = new RegExp(regex);
      const allMatches: string[] = [];
      
      for (const file of files) {
        try {
          const matches = await searchInFile(file, searchRegex);
          allMatches.push(...matches);
        } catch (error) {
          console.warn(`Error searching file ${file}: ${error.message}`);
        }
      }

      if (allMatches.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No matches found for pattern: ${regex}`
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: allMatches.join('\n')
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error searching files: ${error.message}`
        }]
      };
    }
  }
};