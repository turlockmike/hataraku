# Model Context Protocol (MCP) in Hataraku CLI

The Model Context Protocol (MCP) enables communication between Hataraku CLI and locally running MCP servers that provide additional tools and resources to extend Hataraku's capabilities.

## Understanding MCP

MCP servers operate in a non-interactive environment and communicate with Hataraku CLI through a standardized protocol. Each server can provide:

- Tools: Executable functions that can perform actions
- Resources: Data sources that can be accessed
- Resource Templates: Dynamic resource patterns

## Built-in MCP Servers

Hataraku CLI comes with two built-in MCP servers:

1. mcp-rand
   - Tools for random number generation, UUIDs, and more
   - Example: `generate_uuid`, `generate_random_number`

2. extend-mcp
   - Integration tools for GitHub and JIRA
   - Example: `github_create_pr`, `jira_create_ticket`

## Creating an MCP Server

1. Create a new project using the MCP SDK:
```bash
npx @modelcontextprotocol/create-server my-server
cd my-server
npm install
```

2. Implement your server in `src/index.ts`:
```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';

class MyServer {
    private server: Server;

    constructor() {
        this.server = new Server(
            {
                name: 'my-server',
                version: '0.1.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupToolHandlers();
        
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }

    private setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'my_tool',
                    description: 'Description of my tool',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            param1: {
                                type: 'string',
                                description: 'Parameter description',
                            },
                        },
                        required: ['param1'],
                    },
                },
            ],
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name !== 'my_tool') {
                throw new McpError(
                    ErrorCode.MethodNotFound,
                    `Unknown tool: ${request.params.name}`
                );
            }

            // Implement your tool logic here
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Tool result',
                    },
                ],
            };
        });
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('My MCP server running on stdio');
    }
}

const server = new MyServer();
server.run().catch(console.error);
```

3. Build your server:
```bash
npm run build
```

## Installing an MCP Server

1. Add your server to Hataraku's MCP settings file at `~/.hataraku/mcp_settings.json`:
```json
{
    "mcpServers": {
        "my-server": {
            "command": "node",
            "args": ["/path/to/my-server/build/index.js"],
            "env": {
                "MY_ENV_VAR": "value"
            }
        }
    }
}
```

2. Your server will be automatically loaded when Hataraku starts.

## Using MCP Tools

Use MCP tools in your tasks with the `use_mcp_tool` command:

```xml
<use_mcp_tool>
<server_name>my-server</server_name>
<tool_name>my_tool</tool_name>
<arguments>
{
    "param1": "value"
}
</arguments>
</use_mcp_tool>
```

## Best Practices

1. **Error Handling**: Always provide clear error messages when tools fail
2. **Input Validation**: Use JSON Schema to validate tool inputs
3. **Documentation**: Document your tools and their parameters clearly
4. **Environment Variables**: Use environment variables for sensitive configuration
5. **Stateless Design**: Design tools to be stateless where possible

## Debugging

1. Use the `--debug` flag with Hataraku CLI to see detailed MCP interactions:
```bash
Hataraku "Your task" --debug
```

2. Check your server's stderr output in the debug logs

3. Verify server connection status with:
```bash
Hataraku "What tools are available?" --tools
```

## Common Issues

1. **Server Not Found**: Check the path in your MCP settings
2. **Connection Failed**: Ensure the server executable has proper permissions
3. **Tool Not Found**: Verify the tool name matches exactly
4. **Invalid Arguments**: Check the tool's input schema