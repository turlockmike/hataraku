import { OpenAiProvider } from "./openai"
import { ModelProviderOptions, ModelInfo } from "../../shared/api"
import { deepSeekModels, deepSeekDefaultModelId } from "../../shared/api"

export class DeepSeekProvider extends OpenAiProvider {
    constructor(options: ModelProviderOptions) {
        if (!options.deepSeekApiKey) {
            throw new Error("DeepSeek API key is required. Please provide it in the settings.")
        }
        super({
            ...options,
            openAiApiKey: options.deepSeekApiKey,
            openAiModelId: options.deepSeekModelId ?? deepSeekDefaultModelId,
            openAiBaseUrl: options.deepSeekBaseUrl ?? "https://api.deepseek.com/v1",
            includeMaxTokens: true
        })
    }

    override getModel(): { id: string; info: ModelInfo } {
        const modelId = this.options.deepSeekModelId ?? deepSeekDefaultModelId
        return {
            id: modelId,
            info: deepSeekModels[modelId as keyof typeof deepSeekModels] || deepSeekModels[deepSeekDefaultModelId]
        }
    }
}
