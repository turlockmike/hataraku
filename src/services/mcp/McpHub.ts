import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport, StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js"
import {
	CallToolResultSchema,
	ListResourcesResultSchema,
	ListResourceTemplatesResultSchema,
	ListToolsResultSchema,
	ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js"
import chokidar, { FSWatcher } from "chokidar"
import delay from "delay"
import deepEqual from "fast-deep-equal"
import * as fs from "fs/promises"
import * as path from "path"
import { z } from "zod"
import {
	McpResource,
	McpResourceResponse,
	McpResourceTemplate,
	McpServer,
	McpTool,
	McpToolCallResponse,
} from "../../shared/mcp"
import { fileExistsAtPath } from "../../utils/fs"
import { arePathsEqual } from "../../utils/path"

export type McpConnection = {
	server: McpServer
	client: Client
	transport: StdioClientTransport
}

const AlwaysAllowSchema = z.array(z.string()).default([])

const StdioConfigSchema = z.object({
	command: z.string(),
	args: z.array(z.string()).optional(),
	env: z.record(z.string()).optional(),
	alwaysAllow: AlwaysAllowSchema.optional(),
	disabled: z.boolean().optional()
})

const McpSettingsSchema = z.object({
	mcpServers: z.record(StdioConfigSchema)
})

export class McpHub {
	private fileWatchers: Map<string, FSWatcher> = new Map()
	connections: McpConnection[] = []
	isConnecting: boolean = false
	private settingsPath: string
	private mcpServersPath: string

	constructor(settingsPath: string, mcpServersPath: string) {
		this.settingsPath = settingsPath
		this.mcpServersPath = mcpServersPath
		this.watchMcpSettingsFile()
		this.initializeMcpServers()
	}

	getServers(): McpServer[] {
		return this.connections
			.filter((conn) => !conn.server.disabled)
			.map((conn) => conn.server)
	}

	getMcpServersPath(): string {
		return this.mcpServersPath
	}

	getMcpSettingsFilePath(): string {
		return this.settingsPath
	}

	private async watchMcpSettingsFile(): Promise<void> {
		const watcher = chokidar.watch(this.settingsPath, {
			persistent: true,
			ignoreInitial: true,
		})

		watcher.on("change", async () => {
			try {
				const content = await fs.readFile(this.settingsPath, "utf-8")
				const config = JSON.parse(content)
				const result = McpSettingsSchema.safeParse(config)
				if (!result.success) {
					console.error("Invalid MCP settings format")
					return
				}
				await this.updateServerConnections(result.data.mcpServers || {})
			} catch (error) {
				console.error("Failed to process MCP settings change:", error)
			}
		})
	}

	private async initializeMcpServers(): Promise<void> {
		try {
			if (!fileExistsAtPath(this.settingsPath)) {
				console.debug("No MCP settings file found at", this.settingsPath)
				return
			}
			const content = await fs.readFile(this.settingsPath, "utf-8")
			const config = JSON.parse(content)
			await this.updateServerConnections(config.mcpServers || {})
		} catch (error) {
			console.error("Failed to initialize MCP servers:", error)
		}
	}

	private async connectToServer(name: string, config: StdioServerParameters): Promise<void> {
		this.connections = this.connections.filter((conn) => conn.server.name !== name)

		try {
			const client = new Client(
				{
					name: "Hataraku",
					version: "1.0.0",
				},
				{
					capabilities: {},
				},
			)

			const transport = new StdioClientTransport({
				command: config.command,
				args: config.args,
				env: {
					...config.env,
					...(process.env.PATH ? { PATH: process.env.PATH } : {}),
				},
				stderr: "pipe",
			})

			transport.onerror = async (error) => {
				console.error(`Transport error for "${name}":`, error)
				const connection = this.connections.find((conn) => conn.server.name === name)
				if (connection) {
					connection.server.status = "disconnected"
					this.appendErrorMessage(connection, error.message)
				}
			}

			transport.onclose = async () => {
				const connection = this.connections.find((conn) => conn.server.name === name)
				if (connection) {
					connection.server.status = "disconnected"
				}
			}

			if (!StdioConfigSchema.safeParse(config).success) {
				console.error(`Invalid config for "${name}": missing or invalid parameters`)
				const connection: McpConnection = {
					server: {
						name,
						config: JSON.stringify(config),
						status: "disconnected",
						error: "Invalid config: missing or invalid parameters",
					},
					client,
					transport,
				}
				this.connections.push(connection)
				return
			}

			const parsedConfig = StdioConfigSchema.parse(config)
			const connection: McpConnection = {
				server: {
					name,
					config: JSON.stringify(config),
					status: "connecting",
					disabled: parsedConfig.disabled,
				},
				client,
				transport,
			}
			this.connections.push(connection)

			await transport.start()
			const stderrStream = transport.stderr
			if (stderrStream) {
				stderrStream.on("data", async (data: Buffer) => {
					const errorOutput = data.toString()
					console.error(`Server "${name}" stderr:`, errorOutput)
					const connection = this.connections.find((conn) => conn.server.name === name)
					if (connection) {
						this.appendErrorMessage(connection, errorOutput)
					}
				})
			} else {
				console.error(`No stderr stream for ${name}`)
			}
			transport.start = async () => {}

			await client.connect(transport)
			connection.server.status = "connected"
			connection.server.error = ""

			connection.server.tools = await this.fetchToolsList(name)
			connection.server.resources = await this.fetchResourcesList(name)
			connection.server.resourceTemplates = await this.fetchResourceTemplatesList(name)
		} catch (error) {
			const connection = this.connections.find((conn) => conn.server.name === name)
			if (connection) {
				connection.server.status = "disconnected"
				this.appendErrorMessage(connection, error instanceof Error ? error.message : String(error))
			}
			throw error
		}
	}

	private appendErrorMessage(connection: McpConnection, error: string) {
		const newError = connection.server.error ? `${connection.server.error}\n${error}` : error
		connection.server.error = newError
	}

	private async fetchToolsList(serverName: string): Promise<McpTool[]> {
		try {
			const response = await this.connections
				.find((conn) => conn.server.name === serverName)
				?.client.request({ method: "tools/list" }, ListToolsResultSchema)

			const content = await fs.readFile(this.settingsPath, "utf-8")
			const config = JSON.parse(content)
			const alwaysAllowConfig = config.mcpServers[serverName]?.alwaysAllow || []

			const tools = (response?.tools || []).map(tool => ({
				name: tool.name || 'unknown_tool',
				description: tool.description,
				inputSchema: tool.inputSchema,
				alwaysAllow: alwaysAllowConfig.includes(tool.name || 'unknown_tool')
			}))

			return tools
		} catch (error) {
			return []
		}
	}

	private async fetchResourcesList(serverName: string): Promise<McpResource[]> {
		try {
			const response = await this.connections
				.find((conn) => conn.server.name === serverName)
				?.client.request({ method: "resources/list" }, ListResourcesResultSchema)
			
			return (response?.resources || []).map(resource => ({
				uri: resource.uri || '',
				name: resource.name || '',
				description: resource.description,
				mimeType: resource.mimeType
			}))
		} catch (error) {
			return []
		}
	}

	private async fetchResourceTemplatesList(serverName: string): Promise<McpResourceTemplate[]> {
		try {
			const response = await this.connections
				.find((conn) => conn.server.name === serverName)
				?.client.request({ method: "resources/templates/list" }, ListResourceTemplatesResultSchema)
			
			return (response?.resourceTemplates || []).map(template => ({
				uriTemplate: template.uriTemplate || '',
				name: template.name || '',
				description: template.description,
				mimeType: template.mimeType
			}))
		} catch (error) {
			return []
		}
	}

	async deleteConnection(name: string): Promise<void> {
		const connection = this.connections.find((conn) => conn.server.name === name)
		if (connection) {
			try {
				await connection.transport.close()
				await connection.client.close()
			} catch (error) {
				console.error(`Failed to close transport for ${name}:`, error)
			}
			this.connections = this.connections.filter((conn) => conn.server.name !== name)
		}
	}

	async updateServerConnections(newServers: Record<string, any>): Promise<void> {
		this.isConnecting = true
		this.removeAllFileWatchers()
		const currentNames = new Set(this.connections.map((conn) => conn.server.name))
		const newNames = new Set(Object.keys(newServers))

		for (const name of currentNames) {
			if (!newNames.has(name)) {
				await this.deleteConnection(name)
				console.log(`Deleted MCP server: ${name}`)
			}
		}

		for (const [name, config] of Object.entries(newServers)) {
			const currentConnection = this.connections.find((conn) => conn.server.name === name)

			if (!currentConnection) {
				try {
					this.setupFileWatcher(name, config)
					await this.connectToServer(name, config)
				} catch (error) {
					console.error(`Failed to connect to new MCP server ${name}:`, error)
				}
			} else if (!deepEqual(JSON.parse(currentConnection.server.config), config)) {
				try {
					this.setupFileWatcher(name, config)
					await this.deleteConnection(name)
					await this.connectToServer(name, config)
					console.log(`Reconnected MCP server with updated config: ${name}`)
				} catch (error) {
					console.error(`Failed to reconnect MCP server ${name}:`, error)
				}
			}
		}
		this.isConnecting = false
	}

	private setupFileWatcher(name: string, config: any) {
		const filePath = config.args?.find((arg: string) => arg.includes("build/index.js"))
		if (filePath) {
			const watcher = chokidar.watch(filePath, {
				persistent: true,
				ignoreInitial: true,
			})

			watcher.on("change", () => {
				console.log(`Detected change in ${filePath}. Restarting server ${name}...`)
				this.restartConnection(name)
			})

			this.fileWatchers.set(name, watcher)
		}
	}

	private removeAllFileWatchers() {
		this.fileWatchers.forEach((watcher) => watcher.close())
		this.fileWatchers.clear()
	}

	async restartConnection(serverName: string): Promise<void> {
		this.isConnecting = true
		const connection = this.connections.find((conn) => conn.server.name === serverName)
		const config = connection?.server.config
		if (config) {
			console.log(`Restarting ${serverName} MCP server...`)
			connection.server.status = "connecting"
			connection.server.error = ""
			await delay(500)
			try {
				await this.deleteConnection(serverName)
				await this.connectToServer(serverName, JSON.parse(config))
				console.log(`${serverName} MCP server connected`)
			} catch (error) {
				console.error(`Failed to restart connection for ${serverName}:`, error)
			}
		}
		this.isConnecting = false
	}

	async readResource(serverName: string, uri: string): Promise<McpResourceResponse> {
		const connection = this.connections.find((conn) => conn.server.name === serverName)
		if (!connection) {
			throw new Error(`Server "${serverName}" not found`)
		}

		const response = await connection.client.request(
			{
				method: "resources/read",
				params: { uri },
			},
			ReadResourceResultSchema,
		)

		return {
			_meta: response._meta || {},
			contents: (response.contents || []).map(content => ({
				uri: content.uri || '',
				mimeType: content.mimeType as string | undefined,
				text: content.text as string | undefined,
				blob: content.blob as string | undefined
			}))
		}
	}

	async callTool(
		serverName: string,
		toolName: string,
		toolArguments?: Record<string, unknown>,
	): Promise<McpToolCallResponse> {
		const connection = this.connections.find((conn) => conn.server.name === serverName)
		if (!connection) {
			throw new Error(`Server "${serverName}" not found`)
		}

		const response = await connection.client.request(
			{
				method: "tools/call",
				params: {
					name: toolName,
					arguments: toolArguments || {},
				},
			},
			CallToolResultSchema,
		)

		return {
			_meta: response._meta || {},
			content: (response.content || []).map(item => {
				if (!item || typeof item !== 'object' || !('type' in item)) {
					throw new Error('Invalid content item in response')
				}

				const typedItem = item as { type: string; text?: unknown; data?: unknown; mimeType?: unknown; resource?: unknown }
				
				switch (typedItem.type) {
					case 'text':
						return {
							type: 'text' as const,
							text: String(typedItem.text || '')
						}
					case 'image':
						return {
							type: 'image' as const,
							data: String(typedItem.data || ''),
							mimeType: String(typedItem.mimeType || 'image/png')
						}
					case 'resource':
						if (!typedItem.resource || typeof typedItem.resource !== 'object') {
							throw new Error('Invalid resource in response')
						}
						const resource = typedItem.resource as { uri?: unknown; mimeType?: unknown; text?: unknown; blob?: unknown }
						return {
							type: 'resource' as const,
							resource: {
								uri: String(resource.uri || ''),
								mimeType: resource.mimeType as string | undefined,
								text: resource.text as string | undefined,
								blob: resource.blob as string | undefined
							}
						}
					default:
						throw new Error(`Unknown content type: ${String(typedItem.type)}`)
				}
			}),
			isError: response.isError
		}
	}

	async dispose(): Promise<void> {
		this.removeAllFileWatchers()
		for (const connection of this.connections) {
			try {
				await this.deleteConnection(connection.server.name)
			} catch (error) {
				console.error(`Failed to close connection for ${connection.server.name}:`, error)
			}
		}
		this.connections = []
	}
}
