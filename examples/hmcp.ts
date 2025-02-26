import { HatarakuMcpServer, createBedrockProvider } from 'hataraku';

/**
 * This example demonstrates running Hataraku as an MCP server.
 * It exposes Hataraku's built-in tasks as MCP tools:
 * 
 * 1. Code Analysis Task
 *    - Analyzes code for complexity and potential issues
 *    - Provides improvement suggestions
 *    - Identifies risks and technical debt
 * 
 * 2. Bug Analysis Task
 *    - Analyzes bug reports and stack traces
 *    - Provides root cause analysis
 *    - Suggests fixes and prevention measures
 * 
 * 3. PR Review Task
 *    - Reviews code changes in pull requests
 *    - Provides structured feedback
 *    - Suggests improvements and identifies risks
 * 
 * 4. Refactoring Plan Task
 *    - Creates structured refactoring plans
 *    - Breaks down changes into steps
 *    - Assesses risks and effort
 * 
 * Usage:
 * ```bash
 * # Run with stdio transport (default)
 * npm run example:hataraku-mcp
 * 
 * # Run with WebSocket transport for Inspector
 * npm run example:hataraku-mcp -- --inspector
 * ```
 * 
 * When using --inspector, open https://modelcontextprotocol.io/inspector
 * and connect to ws://localhost:7324
 */

// Create a basic model implementation for the example


async function startServer() {
  const bedrock = await createBedrockProvider('default');
  const model = bedrock('us.anthropic.claude-3-5-sonnet-20241022-v2.0');
  const server = new HatarakuMcpServer(model);
  await server.start();
  // console.log('Hataraku MCP server running on stdio');
}

// Start server when run directly

startServer()
