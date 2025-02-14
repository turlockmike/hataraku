import { createAgent } from '../core/agent';
import { getMcpTools } from '../core/mcp/toolWrapper';
import { JiraGetTicketTool } from '../core/mcp/types';
import chalk from 'chalk';
import { createBedrockProvider } from '../core/providers/bedrock';


const SYSTEM_PROMPT = `You are a helpful AI assistant that can use various tools to accomplish tasks.
When suggesting improvements to text, you should:
1. Be concise and direct
2. Maintain the core meaning
3. Use active voice
4. Remove unnecessary words
5. Keep technical terms intact`;

async function main() {
    console.log(chalk.cyan('\n🤖 Agent Example\n'));

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
        });

        try {
            // Initialize OpenAI provider
            const bedrock = await createBedrockProvider();
            const model = bedrock('us.anthropic.claude-3-5-sonnet-20241022-v2:0');

            // Create agent with MCP tools
            const agent = createAgent({
                name: 'MCP Agent',
                description: 'An agent that can use MCP tools',
                role: SYSTEM_PROMPT,
                model,
                tools: mcpTools,
            });

            // Run the agent
            const result = await agent.task(`Get the Jira ticket DX-3320 and DX-3321 using the extend-cli_jira_get_ticket tool. 
            Then suggest a more detailed summary of the two tickets to make it easier to understand.
            Format your response as:
            
            Original Summary: [original]
            Suggested Summary: [your suggestion]`);

            // Display result
            console.log(chalk.cyan('\n📝 Agent Result:'));
            console.log(chalk.green(result));
            console.log();

        } finally {
            await disconnect();
        }

    } catch (error) {
        console.error(chalk.red('\n❌ Error:'), error);
        process.exit(1);
    }
}

main();