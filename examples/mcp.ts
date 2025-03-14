import { createAgent, createBedrockModel, getMcpTools } from 'hataraku'
import chalk from 'chalk'

const SYSTEM_PROMPT = `You are a helpful AI assistant that can use various tools to accomplish tasks.
When suggesting improvements to text, you should:
1. Be concise and direct
2. Maintain the core meaning
3. Use active voice
4. Remove unnecessary words
5. Keep technical terms intact`

async function main() {
  console.log(chalk.cyan('\n🤖 Agent Example\n'))

  try {
    // Initialize MCP tools
    const { tools: mcpTools, disconnect } = await getMcpTools({
      config: {
        mcpServers: {
          'extend-cli': {
            command: 'ec',
            args: ['mcp'],
            env: {
              HOME: process.env.HOME || '/home/user',
              PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
            },
          },
        },
      },
    })

    try {
      // Initialize OpenAI provider
      const model = await createBedrockModel('default')

      // Create agent with MCP tools
      const agent = createAgent({
        name: 'MCP Agent',
        description: 'An agent that can use MCP tools',
        role: SYSTEM_PROMPT,
        model,
        tools: mcpTools,
      })

      // Run the agent
      const result =
        await agent.task(`Get the Jira ticket DX-3320 and DX-3321 using the extend-cli_jira_get_ticket tool. 
            Then suggest a more detailed summary of the two tickets to make it easier to understand.
            Format your response as:
            
            Original Summary: [original]
            Suggested Summary: [your suggestion]`)

      // Display result
      console.log(chalk.cyan('\n📝 Agent Result:'))
      console.log(chalk.green(result))
      console.log()
    } finally {
      await disconnect()
      process.exit(0)
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error)
    process.exit(1)
  }
}

main()
