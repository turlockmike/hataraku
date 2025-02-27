import { createTask, createAgent, createBedrockModel, applyDiffTool, searchReplaceV2Tool } from 'hataraku';
import { z } from 'zod';
import {
  readFileTool,
} from 'hataraku';


const model = createBedrockModel(); //Defaults to sonnet 3.7
const jsdocAgent = createAgent({
  name: 'JSDoc Generator',
  description: 'An agent that analyzes code and adds JSDoc comments to exported functions',
  role: 'You are a code documentation expert that specializes in adding JSDoc comments to TypeScript/JavaScript code. You analyze code to understand function signatures, parameters, return types, and behavior, then generate comprehensive JSDoc comments.',
  model: model,
  tools: {
    read_file: readFileTool,
    search_and_replace: searchReplaceV2Tool,
  }
});


export const analyzeFileTask = createTask({
  name: 'Analyze and Update File',
  description: 'Analyzes a file to identify exported functions that need JSDoc comments and updates the file',
  agent: jsdocAgent,
  inputSchema: z.object({ 
    filePath: z.string(),
    exportedFunctions: z.array(z.object({
      name: z.string(),
      kind: z.string().optional(),
      source: z.string().optional(),
      originalSource: z.string().optional(),
      documentation: z.string().optional(),
      isDefault: z.boolean().optional()
    })).optional()
  }),
  task: (input) =>
    `Analyze the file at ${input.filePath} to identify exported functions, classes, and interfaces that need JSDoc comments.
      
      
      1. Read the file content
      2. IMPORTANT: Only document actual function/class/interface definitions, NOT re-exports
        - Skip index files that only re-export from other files
        - Focus on files where the actual implementation is defined
        - If a file only has "export * from './something'" statements, skip it
      3. For each ACTUAL exported function/class/interface definition (not re-exports):
        - Determine its signature (parameters, return type)
        - Check if it already has JSDoc comments
        - If it doesn't have JSDoc comments or the comments are incomplete, generate comprehensive JSDoc comments
        - If a class is exported, document all non-private methods and properties
      4. Update the file content with the new JSDoc comments
      
      Follow these JSDoc guidelines:
      - Include a description of what the function/class/interface does
      - Document all parameters with @param tags, including types and descriptions
      - Document return values with @return tags, including types and descriptions
      - Add @example tags with usage examples where appropriate
      - Use @throws tags to document exceptions that might be thrown
      
      5. If changes were made, use the search_and_replace tool to save the updated content back to ${input.filePath}. Only document 1 item at a time. 
      
      You don't need to return any data, just update the file if needed. Otherwise finish the task.`
});
  