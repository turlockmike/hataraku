import { ModelConfiguration } from "../shared/api"
import { modelProviderFromConfig, SingleCompletionHandler } from "../api"
import { defaultPrompts } from "../shared/modes"

/**
 * Enhances a prompt using the configured API without creating a full Cline instance or task history.
 * This is a lightweight alternative that only uses the API's completion functionality.
 */
export async function enhancePrompt(apiConfiguration: ModelConfiguration, promptText: string, enhancePrompt?: string): Promise<string> {
    if (!promptText) {
        throw new Error("No prompt text provided")
    }
    if (!apiConfiguration || !apiConfiguration.apiProvider) {
        throw new Error("No valid API configuration provided")
    }
    
    const handler = modelProviderFromConfig(apiConfiguration)
    
    // Check if handler supports single completions
    if (!('completePrompt' in handler)) {
        throw new Error("The selected API provider does not support prompt enhancement")
    }
    
    const enhancePromptText = enhancePrompt ?? defaultPrompts.enhance
    const prompt = `${enhancePromptText}\n\n${promptText}`
    return (handler as SingleCompletionHandler).completePrompt(prompt)
}