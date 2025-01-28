import { McpHub } from '../McpHub'
import * as fs from 'fs/promises'
import path from 'path'

jest.mock('fs/promises')
jest.mock('chokidar', () => ({
    watch: jest.fn().mockReturnValue({
        on: jest.fn(),
        close: jest.fn()
    })
}))

describe('McpHub', () => {
    const mockSettingsPath = '/mock/settings.json'
    const mockServersPath = '/mock/servers'
    let mcpHub: McpHub

    beforeEach(() => {
        jest.clearAllMocks()
        ;(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({
            mcpServers: {
                'test-server': {
                    command: 'test-command',
                    args: ['--test'],
                    env: { TEST: 'true' }
                }
            }
        }))
        mcpHub = new McpHub(mockSettingsPath, mockServersPath)
    })

    afterEach(async () => {
        await mcpHub.dispose()
    })

    test('initializes with empty server list', () => {
        expect(mcpHub.getServers()).toEqual([])
    })

    test('connects to configured servers on initialization', async () => {
        // Wait for initialization to complete
        await new Promise(resolve => setTimeout(resolve, 0))
        
        expect(mcpHub.connections.length).toBe(1)
        expect(mcpHub.connections[0].server.name).toBe('test-server')
        expect(mcpHub.connections[0].server.status).toBe('connecting')
    })

    test('handles invalid settings file', async () => {
        ;(fs.readFile as jest.Mock).mockResolvedValue('invalid json')
        
        const newHub = new McpHub(mockSettingsPath, mockServersPath)
        await new Promise(resolve => setTimeout(resolve, 0))
        
        expect(newHub.connections.length).toBe(0)
    })

    test('updates server connections when settings change', async () => {
        const newSettings = {
            mcpServers: {
                'new-server': {
                    command: 'new-command',
                    args: ['--new'],
                    env: { NEW: 'true' }
                }
            }
        }
        
        await mcpHub.updateServerConnections(newSettings.mcpServers)
        
        expect(mcpHub.connections.length).toBe(1)
        expect(mcpHub.connections[0].server.name).toBe('new-server')
    })

    test('disposes connections properly', async () => {
        await mcpHub.dispose()
        expect(mcpHub.connections.length).toBe(0)
    })
})