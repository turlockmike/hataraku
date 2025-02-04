/**
 * Testing utilities for Hataraku SDK
 * @module testing
 */

export { MockProvider } from './MockProvider';
export { MockTool } from './MockTool';

/**
 * Example usage:
 * ```typescript
 * import { MockProvider, MockTool } from 'hataraku/testing';
 * 
 * // Create and configure a mock provider
 * const mockProvider = new MockProvider();
 * mockProvider.mockResponse('test response');
 * 
 * // Create and configure a mock tool
 * const mockTool = MockTool.createBasic('test_tool');
 * mockTool.mockResponse({ result: 'success' });
 * 
 * // Create an agent with mocks
 * const agent = new Agent({
 *   model: mockProvider,
 *   tools: [mockTool]
 * });
 * 
 * // Execute a task
 * const result = await agent.task({
 *   role: 'user',
 *   content: 'test task'
 * });
 * 
 * // Verify provider interactions
 * console.assert(mockProvider.getCallCount() === 1);
 * const providerCall = mockProvider.getCall(0);
 * console.assert(providerCall.messages[0].content === 'test task');
 * 
 * // Verify tool interactions
 * console.assert(mockTool.getCallCount() === 1);
 * const toolCall = mockTool.getCall(0);
 * console.assert(toolCall.params.input === 'test input');
 * 
 * // Verify initialization
 * console.assert(mockTool.getInitializeCallCount() === 1);
 * ```
 * 
 * Both MockProvider and MockTool support:
 * - Queueing success/error responses
 * - Tracking calls and arguments
 * - Verifying initialization
 * - Default responses when no mock is queued
 */