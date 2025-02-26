import chalk from 'chalk';
import { getMcpTools } from '../src/core/mcp/toolWrapper';
import { JiraGetTicketTool } from '../src/core/mcp/types';

async function main() {
  console.log(chalk.cyan('\n🎫 MCP Jira Example\n'));

  try {
    // Configure MCP tools
    const { tools: mcpTools, disconnect: cleanup } = await getMcpTools({
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
      // Get the Jira tool and fetch ticket
      const jiraTool = mcpTools['extend-cli_jira_get_ticket'] as JiraGetTicketTool;
      const { data: ticket } = await jiraTool.execute(
        { ticketId: 'DX-3320' },
        { toolCallId: 'jira-get-ticket', messages: [] }
      );

      // Display result
      console.log(chalk.cyan('📤 Ticket Details:'));
      console.log(chalk.gray('   Summary:', ticket.summary));
      console.log(chalk.gray('   Status:', ticket.status));
      console.log(chalk.gray('   Type:', ticket.type));
      console.log(chalk.gray('   Priority:', ticket.priority));
      console.log(chalk.gray('   Assignee:', ticket.assignee?.name || 'Unassigned'));
      console.log(chalk.gray('   Created:', ticket.created));
      console.log(chalk.gray('   Updated:', ticket.updated));
      console.log(chalk.gray('   URL:', ticket.url));
      console.log();


    } finally {
      await cleanup();
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

main();