import { createWorkflow } from 'hataraku'
import { z } from 'zod'
import { createTask } from 'hataraku'
import { Tool } from 'ai'
import chalk from 'chalk'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  readFileTool,
  writeFileTool,
  listFilesTool,
  searchFilesTool,
  listCodeDefinitionsTool,
  fetchTool,
} from 'hataraku'
import { getEnvironmentInfo } from 'hataraku'
import { createBaseAgent, ROLES, DESCRIPTIONS } from './agents/base'

// Define our custom tools
const readPackageJsonTool: Tool = {
  description: 'Read and parse package.json file',
  parameters: z.object({
    path: z.string(),
  }),
  execute: async ({ path }) => {
    console.log(chalk.blue(`📦 Reading package.json at: ${path}`))
    const content = await fs.readFile(path, 'utf-8')
    return {
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
    }
  },
}

const validateUrlTool: Tool = {
  description: 'Validate if a URL is accessible',
  parameters: z.object({
    url: z.string(),
  }),
  execute: async ({ url }) => {
    console.log(chalk.blue(`🔗 Validating URL: ${url}`))
    try {
      const response = await fetch(url, { method: 'HEAD' })
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ valid: response.ok, status: response.status }),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ valid: false, error: error.message }),
          },
        ],
      }
    }
  },
}

const environmentInfo = getEnvironmentInfo()

// Initialize the documentation agent
const initializeDocsAgent = async () => {
  return createBaseAgent({
    name: 'Documentation Agent',
    description: 'An agent that generates and validates documentation',
    role:
      'You are a documentation expert that helps generate and validate technical documentation. You have tools at your disposal. You will be given a task and must complete it using the tools. ' +
      environmentInfo,
    tools: {
      // File operations
      read_file: readFileTool,
      write_file: writeFileTool,
      list_files: listFilesTool,
      search_files: searchFilesTool,

      // Code analysis
      list_code_definitions: listCodeDefinitionsTool,

      // Package analysis
      readPackageJson: readPackageJsonTool,

      // Network operations
      fetch: fetchTool,
    },
  })
}

// Define our schemas
const repoAnalysisSchema = z.object({
  name: z.string(),
  version: z.string(),
  dependencies: z.record(z.string(), z.string()),
  devDependencies: z.record(z.string(), z.string()).optional(),
  fileStructure: z.array(z.string()),
  mainEntryPoints: z.array(z.string()),
})

const fileAnalysisSchema = z.object({
  filePath: z.string(),
  isPublic: z.boolean(),
  exports: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['function', 'class', 'variable', 'type', 'interface']),
      description: z.string(),
      signature: z.string(),
      examples: z.array(z.string()).optional(),
    }),
  ),
  dependencies: z.array(z.string()),
  usage: z.array(z.string()).optional(),
})

const fileAnalysisSchemaArray = z.object({
  files: z.array(fileAnalysisSchema),
})

const detailedDocsSchema = z.object({
  componentName: z.string(),
  description: z.string(),
  usage: z.string(),
  api: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      description: z.string(),
      parameters: z
        .array(
          z.object({
            name: z.string(),
            type: z.string(),
            description: z.string(),
            required: z.boolean(),
          }),
        )
        .optional(),
      returns: z.string().optional(),
      examples: z.array(z.string()),
    }),
  ),
  configuration: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        description: z.string(),
        default: z.string().optional(),
      }),
    )
    .optional(),
})

const documentationOutputSchema = z.object({
  componentName: z.string(),
  docPath: z.string(),
  documentation: detailedDocsSchema,
})

type DocumentationOutput = z.infer<typeof documentationOutputSchema>

const readmeContentSchema = z.object({
  title: z.string(),
  description: z.string(),
  installation: z.string(),
  usage: z.string(),
  features: z.array(z.string()),
  api: z.string(),
  examples: z.array(z.string()),
  contributing: z.string(),
  license: z.string(),
  detailedDocs: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      description: z.string(),
    }),
  ),
})

// Define our workflow output schema
const docsWorkflowSchema = z.object({
  repoAnalysis: repoAnalysisSchema,
  fileAnalyses: z.array(fileAnalysisSchema),
  detailedDocs: z.array(detailedDocsSchema),
  readmeContent: readmeContentSchema,
})

type DocsWorkflowResult = z.infer<typeof docsWorkflowSchema>

async function main() {
  // Create necessary directories
  await fs.mkdir('docs', { recursive: true })

  console.log(chalk.cyan('\n🚀 Starting documentation workflow\n'))

  // Initialize tasks
  const tasks = await initializeTasks()

  // Create our workflow
  const docsWorkflow = createWorkflow<{ repoPath: string }>(
    {
      name: 'Repository Documentation',
      description: 'Generates and validates repository documentation',
      onTaskStart: taskName => {
        console.log(chalk.magenta(`⚡ Starting task: ${taskName}`))
      },
      onTaskComplete: (taskName, result) => {
        console.log(chalk.magenta(`🏁 Completed task: ${taskName}`))
        console.log(chalk.gray(`   Result: ${JSON.stringify(result)}\n`))
      },
    },
    async w => {
      console.log(chalk.cyan('📊 Analyzing repository...'))

      // Step 1: Analyze repository structure
      const repoAnalysis = (await w.task('Repository Analysis', tasks.analyzeRepo, {
        path: w.input.repoPath,
      })) as z.infer<typeof repoAnalysisSchema>

      // Log the entry points being analyzed
      console.log(chalk.cyan('\n📁 Source files to analyze:'))
      repoAnalysis.mainEntryPoints.forEach(file => {
        console.log(chalk.gray(`   ${file}`))
      })

      // Step 2: Analyze each source file
      console.log(chalk.cyan('\n📝 Analyzing source files...'))
      const sourceFiles = repoAnalysis.mainEntryPoints

      // First determine exports for each file
      const exportAnalyses = await Promise.all(
        sourceFiles.map(filePath => w.task(`Determine Exports: ${filePath}`, tasks.determineExports, { filePath })),
      )

      // Flatten the array of arrays into a single array of file analyses
      const fileAnalyses = exportAnalyses.map(analysis => (analysis as any).files).flat()

      // Filter out files with no exports
      let filesWithExports = fileAnalyses.filter(analysis => analysis.exports && analysis.exports.length > 0)

      // For testing, limit the number of files to analyze
      filesWithExports = filesWithExports.slice(0, 3)

      console.log(
        chalk.cyan(
          `\n📝 Found ${filesWithExports.length} files with exports out of ${fileAnalyses.length} total files`,
        ),
      )

      // Generate documentation for files with exports
      console.log(chalk.cyan('\n📚 Generating documentation...'))
      const publicFiles = filesWithExports.filter(analysis => analysis.isPublic)
      const documentationResults = (await Promise.all(
        publicFiles.map(analysis =>
          w.task(`Generate Documentation: ${analysis.filePath}`, tasks.generateDocumentation, analysis),
        ),
      )) as DocumentationOutput[]

      // Step 4: Generate README
      console.log(chalk.cyan('\n📖 Generating README...'))
      const readmeContent = (await w.task('Generate README.md', tasks.generateReadme, {
        repoAnalysis,
        detailedDocs: documentationResults.map(result => result.documentation),
      })) as z.infer<typeof readmeContentSchema>

      // Return the final result
      return {
        repoAnalysis,
        fileAnalyses: filesWithExports,
        detailedDocs: documentationResults.map(result => result.documentation),
        readmeContent,
      }
    },
  )

  // Execute the workflow
  const input = {
    repoPath: './',
  }

  console.log(chalk.cyan('📥 Input:'))
  console.log(chalk.gray(`   Repository path: ${input.repoPath}\n`))

  const result = await docsWorkflow.run(input, {
    outputSchema: docsWorkflowSchema,
  })

  console.log(chalk.cyan('\n📊 Final Results:'))
  console.log(chalk.gray(`   Repository Analysis: ${JSON.stringify(result.repoAnalysis, null, 2)}`))
  console.log(chalk.gray(`   File Analyses: ${JSON.stringify(result.fileAnalyses, null, 2)}`))
  console.log(chalk.gray(`   Detailed Docs: ${JSON.stringify(result.detailedDocs, null, 2)}`))
  console.log(chalk.gray(`   README Content: ${JSON.stringify(result.readmeContent, null, 2)}\n`))
}

// Initialize tasks
const initializeTasks = async () => {
  const docsAgent = await initializeDocsAgent()

  const analyzeRepoTask = createTask({
    name: 'Analyze Repository',
    description: 'Analyzes Node.js repository structure and package information',
    agent: docsAgent,
    inputSchema: z.object({ path: z.string() }),
    outputSchema: repoAnalysisSchema,
    task: input =>
      `Analyze the repository at ${input.path}. Use the readPackageJson tool to read package.json and list_files tool to understand the file structure. Focus on:
       1. Package name and version from package.json
       2. Dependencies and their versions from package.json
       3. File structure and organization
       4. Main entry points and important files:
          - Look for TypeScript (.ts) files in the src directory
          - Exclude test files, dist directory, and node_modules
          - Focus on files that export functionality (e.g., src/core/*.ts)
          - Include index.ts files that re-export functionality
       
       When listing main entry points, use relative paths and only include .ts files.
       Do NOT include any files from the dist/ directory.`,
  })

  const determineExportsTask = createTask({
    name: 'Determine Exported Items',
    description: 'Determines the nested exported items in a file',
    agent: docsAgent,
    inputSchema: z.object({ filePath: z.string() }),
    outputSchema: fileAnalysisSchemaArray,
    task: input =>
      `Determine the nested exported items in the file at ${input.filePath}. Return a list of all exported items. If the file is a dist or test file, ignore it and return immediately (still following the correct schema). If an exported item is defined in a different file, read that file and determine the exported items in that file. Iterate as deeply as you need, but ignore items from external node_modules (since those are documented elsewhere) `,
  })

  const generateDocumentationTask = createTask({
    name: 'Generate Documentation',
    description: 'Generates user-friendly documentation for a component',
    agent: docsAgent,
    inputSchema: fileAnalysisSchema,
    outputSchema: documentationOutputSchema,
    task: input =>
      `Generate user-friendly documentation for the component at ${
        input.filePath
      }. First read the file to understand the component.
       Use this previous Analysis: ${JSON.stringify(input)}
       
       Create comprehensive documentation that includes:
       1. Component overview and description
       2. Detailed API documentation for each export
       3. Usage examples and patterns
       4. Configuration options if applicable
       
       The documentation should be:
       - Clear and easy to understand
       - Include practical examples
       - Show type signatures in TypeScript
       - Include common use cases
       - Highlight any important notes or caveats
       
       Save the documentation to docs/${path.basename(input.filePath, '.ts')}.md
       Return both the path to the documentation and the structured content.`,
  })

  const generateReadmeTask = createTask({
    name: 'Generate README',
    description: 'Generates the main README.md file',
    agent: docsAgent,
    inputSchema: z.object({
      repoAnalysis: repoAnalysisSchema,
      detailedDocs: z.array(detailedDocsSchema),
    }),
    outputSchema: readmeContentSchema,
    task: input =>
      `Generate a comprehensive README.md file for the repository. Use the repository analysis and detailed documentation to create a complete overview.
       
       Repository Analysis: ${JSON.stringify(input.repoAnalysis)}
       Detailed Documentation: ${JSON.stringify(input.detailedDocs)}
       
       The README should include:
       1. Project title and description
       2. Installation instructions
       3. Basic usage examples
       4. Key features
       5. API overview (with links to detailed docs)
       6. Contributing guidelines
       7. License information
       
       Make it clear, concise, and well-structured.`,
  })

  return {
    analyzeRepo: (input: { path: string }) => analyzeRepoTask.run(input),
    determineExports: (input: { filePath: string }) => determineExportsTask.run(input),
    generateDocumentation: (input: z.infer<typeof fileAnalysisSchema>) => generateDocumentationTask.run(input),
    generateReadme: (input: {
      repoAnalysis: z.infer<typeof repoAnalysisSchema>
      detailedDocs: z.infer<typeof detailedDocsSchema>[]
    }) => generateReadmeTask.run(input),
  }
}

// Run the example if this file is executed directly
main()
