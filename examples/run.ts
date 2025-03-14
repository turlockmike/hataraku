#!/usr/bin/env tsx

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables from .env file
// This automatically loads all variables from .env into process.env
dotenv.config()

// Get example name from command line arguments
const exampleName = process.argv[2]
// Get remaining arguments to pass to the example
const exampleArgs = process.argv.slice(3)

if (!exampleName || exampleName === 'run' || exampleName === 'help') {
  console.log('Available examples:')

  // List all TypeScript files in the examples directory
  const exampleFiles = fs
    .readdirSync(__dirname)
    .filter(file => file.endsWith('.ts') && file !== 'run.ts' && file !== 'tsconfig.json')

  exampleFiles.forEach(file => {
    console.log(`  - ${path.basename(file, '.ts')}`)
  })

  console.log('\nUsage: npm run example <example-name> [args...]')
  process.exit(0)
}

// Construct the path to the example file
const exampleFile = path.join(__dirname, `${exampleName}.ts`)

// Check if the example file exists
if (!fs.existsSync(exampleFile)) {
  console.error(`Error: Example '${exampleName}' not found.`)
  process.exit(1)
}

// Special case for hmcp-inspector (previously hataraku-mcp-inspector)
if (exampleName === 'hmcp-inspector') {
  try {
    execSync('npx @modelcontextprotocol/inspector tsx examples/hmcp.ts', {
      stdio: 'inherit',
      env: process.env,
    })
    process.exit(0)
  } catch (error) {
    console.error('Error running inspector:', error)
    process.exit(1)
  }
}

try {
  // Execute the TypeScript file directly instead of requiring it
  // This gives better support for ESM modules and proper execution context
  // Forward any additional arguments to the example
  const argsString = exampleArgs.length > 0 ? ` ${exampleArgs.join(' ')}` : ''
  execSync(`tsx ${exampleFile}${argsString}`, {
    stdio: 'inherit',
    env: process.env,
  })
} catch (error) {
  console.error('Error running example:', error)
  process.exit(1)
}
