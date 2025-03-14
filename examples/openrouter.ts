import chalk from 'chalk'
import { createAgent } from 'hataraku'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// Initialize agent and tasks
async function initializeAgent() {
  // Initialize OpenRouter client
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY || '',
  })
  const model = openrouter('google/gemini-2.0-flash-lite-001')

  // Create a simple greeter agent using our base configuration
  return createAgent({
    name: 'Greeter Agent',
    description: 'A friendly agent that generates greetings',
    role: 'You are a friendly assistant that generates warm greetings for users.',
    model: model,
  })
}

async function main(name: string) {
  console.log(chalk.cyan('\n👋 Basic Task Example\n'))

  try {
    // Initialize tasks
    const agent = await initializeAgent()

    // Define greeter tasks

    // Input
    console.log(chalk.cyan('📥 Input:'))
    console.log(chalk.gray(`   Name: ${name}\n`))

    // Generate greeting
    console.log(chalk.cyan('🤖 Generating greeting...'))
    const greeting = await agent.task(`Generate a warm and friendly greeting for ${name}. Keep it simple and direct.`)

    // Display result
    console.log(chalk.cyan('\n📤 Result:'))
    console.log(chalk.gray(`   ${greeting}\n`))
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error)
    process.exit(1)
  }
}

// Run the example if this file is executed directly
main(process.argv[2] || 'Extend')
