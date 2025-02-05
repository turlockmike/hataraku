import { Anthropic } from "@anthropic-ai/sdk"
import { GlamaProvider } from "./providers/glama"
import { ModelConfiguration as ModelConfiguration, ModelInfo } from "../shared/api"
import { AnthropicProvider } from "./providers/anthropic"
import { AwsBedrockProvider } from "./providers/bedrock"
import { OpenRouterProvider } from "./providers/openrouter"
import { VertexProvider } from "./providers/vertex"
import { OpenAiProvider } from "./providers/openai"
import { OllamaProvider } from "./providers/ollama"
import { LmStudioProvider } from "./providers/lmstudio"
import { GeminiProvider } from "./providers/gemini"
import { OpenAiNativeProvider } from "./providers/openai-native"
import { DeepSeekProvider } from "./providers/deepseek"
import { MistralProvider } from "./providers/mistral"
import { ApiStream } from "./transform/stream"

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

export interface ModelProvider {
	createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream
	getModel(): { id: string; info: ModelInfo }
}

export function modelProviderFromConfig(configuration: ModelConfiguration): ModelProvider {
	const { apiProvider, ...options } = configuration
	switch (apiProvider) {
		case "anthropic":
			return new AnthropicProvider(options)
		case "glama":
			return new GlamaProvider(options)
		case "openrouter":
			return new OpenRouterProvider(options)
		case "bedrock":
			return new AwsBedrockProvider(options)
		case "vertex":
			return new VertexProvider(options)
		case "openai":
			return new OpenAiProvider(options)
		case "ollama":
			return new OllamaProvider(options)
		case "lmstudio":
			return new LmStudioProvider(options)
		case "gemini":
			return new GeminiProvider(options)
		case "openai-native":
			return new OpenAiNativeProvider(options)
		case "deepseek":
			return new DeepSeekProvider(options)
		default:
			throw new Error(`Unsupported API provider: ${apiProvider}`)
	}
}
