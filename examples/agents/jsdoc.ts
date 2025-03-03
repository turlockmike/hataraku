import { createTask, createAgent, createBedrockModel, searchReplaceV2Tool } from 'hataraku';
import { z } from 'zod';
import { readFileTool, executeCommandTool } from 'hataraku';


const model = createBedrockModel(); //Defaults to sonnet 3.7
const jsdocAgent = createAgent({
  name: 'JSDoc Generator',
  description: 'An agent that analyzes code and adds JSDoc comments to exported functions',
  role: 'You are a code documentation expert that specializes in adding JSDoc comments to TypeScript/JavaScript code. You analyze code to understand function signatures, parameters, return types, and behavior, then generate comprehensive JSDoc comments.',
  model: model,
  tools: {
    read_file: readFileTool,
    search_and_replace: searchReplaceV2Tool,
    execute_command: executeCommandTool
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
      filePath: z.string(),
      originalSource: z.string().optional(),
      originalName: z.string().optional(),
      documentation: z.string().optional(),
      isDefault: z.boolean().optional()
    })).optional()
  }),
  task: (input) => {
    // Get unique file paths from exported functions
    const filePaths = new Set<string>();
    if (input.exportedFunctions) {
      input.exportedFunctions.forEach(exp => {
        if (exp.filePath) {
          filePaths.add(exp.filePath);
        }
      });
    }
    
    // Add the input file path if not already included
    filePaths.add(input.filePath);
    
    const filePathsArray = Array.from(filePaths);
    
    return `I will analyze and document the following files:
${filePathsArray.map(path => `- ${path}`).join('\n')}

For each file:

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

5. For each change:
   a. Use the search_and_replace tool to save the updated content back to the file. Only document 1 item at a time.
   b. IMPORTANT: After EACH search_and_replace operation, run:
      \`\`\`bash
      npx eslint ${filePathsArray.join(' ')} --max-warnings 0
      \`\`\`
   c. If lint errors are found, revert the change and try a different approach

You don't need to return any data, just update the files if needed. Otherwise finish the task.`
  }
});
  