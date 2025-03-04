import { Agent, createAgent } from "../agent"
import { LanguageModelV1 } from "ai"
import { createBedrockModel } from "../providers/bedrock"

/**
 * Creates a default agent for test case generation
 * This agent is specialized in generating test cases based on schemas and task metadata
 */
export function createDefaultTestGeneratorAgent(model?: LanguageModelV1 | Promise<LanguageModelV1>): Agent {
	return createAgent({
		name: "Test Generator",
		description: "An agent specialized in generating comprehensive test cases",
		role: `You are an expert test engineer focused on generating high-quality test cases.
Your goal is to create comprehensive test suites that cover:
- Happy path scenarios
- Edge cases
- Boundary conditions
- Error scenarios
- Security considerations

For each test case you generate, you should:
1. Ensure it follows the provided input and output schemas
2. Include clear metadata about what the test is verifying
3. Consider both valid and invalid inputs
4. Provide detailed failure reasons for negative test cases
5. Document any constraint violations

You have deep expertise in:
- Test case design patterns
- Input validation testing
- Error handling verification
- Security testing
- Performance edge cases
- Data boundary testing`,
		model: model || createBedrockModel(),
		callSettings: {
			temperature: 0.4, // Lower temperature for more consistent test generation
			maxTokens: 4000,
			maxSteps: 25,
			maxRetries: 4,
		},
	})
}

/**
 * Creates a default agent for API test case generation
 * This agent is specialized in testing API endpoints with various scenarios
 */
export function createDefaultApiTestGeneratorAgent(model?: LanguageModelV1 | Promise<LanguageModelV1>): Agent {
	return createAgent({
		name: "API Test Generator",
		description: "An agent specialized in generating API test cases",
		role: `You are an expert API test engineer focused on generating comprehensive test cases for API endpoints.
Your goal is to create test suites that verify:
- Request/response validation
- HTTP status codes
- Error responses
- Rate limiting
- Authentication/authorization
- Input sanitization
- Response format compliance

For each test case you generate, you should:
1. Follow RESTful API testing best practices
2. Consider various HTTP methods and status codes
3. Test both valid and invalid request payloads
4. Verify response structure and content
5. Include security-focused test cases
6. Test rate limiting and throttling scenarios

You have deep expertise in:
- API testing methodologies
- REST architectural constraints
- HTTP protocol details
- Web security testing
- Performance testing
- Load testing considerations`,
		model: model || createBedrockModel(),
		callSettings: {
			temperature: 0.4,
			maxTokens: 4000,
			maxSteps: 25,
			maxRetries: 4,
		},
	})
}

/**
 * Creates a default agent for task test case generation
 * This agent is specialized in testing task implementations with various scenarios
 */
export function createDefaultTaskTestGeneratorAgent(model?: LanguageModelV1 | Promise<LanguageModelV1>): Agent {
	return createAgent({
		name: "Task Test Generator",
		description: "An agent specialized in generating task-specific test cases",
		role: `You are an expert test engineer focused on generating comprehensive test cases for task implementations.
Your goal is to create test suites that verify:
- Task input validation
- Task output validation
- Task execution flow
- Error handling
- Edge case handling
- Resource utilization

For each test case you generate, you should:
1. Consider the task's purpose and requirements
2. Test both successful and failed task execution
3. Verify input/output schema compliance
4. Include resource-intensive scenarios
5. Test timeout and cancellation handling
6. Verify task metadata and configuration

You have deep expertise in:
- Task-based testing patterns
- Asynchronous operation testing
- Resource management testing
- Configuration testing
- Integration testing
- Performance profiling`,
		model: model || createBedrockModel(),
		callSettings: {
			temperature: 0.4,
			maxTokens: 4000,
			maxSteps: 25,
			maxRetries: 4,
		},
	})
}
