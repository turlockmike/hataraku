import { createBaseAgent, ROLES, DESCRIPTIONS } from './agents/base'

async function main() {
  // Get query from command line arguments
  const query = process.argv.slice(2).join(' ')

  if (!query) {
    console.error('Please provide a query. Usage: npm run example -- your query here')
    process.exit(1)
  }

  // Create and initialize agent
  const agent = await createBaseAgent({
    name: 'Simple Task Agent',
    description: DESCRIPTIONS.ASSISTANT,
    role: ROLES.ASSISTANT,
  })

  try {
    // Execute task and get complete response
    console.log('\nResponse:\n')
    const response = await agent.task(query)
    console.log(await response)
    console.log() // Add newline at end
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the program
main().catch(console.error)
