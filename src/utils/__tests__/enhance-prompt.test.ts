import { enhancePrompt } from '../enhance-prompt'
import { ModelConfiguration } from '../../shared/api'
import { modelProviderFromConfig, SingleCompletionHandler } from '../../api'
import { defaultPrompts } from '../../shared/modes'

// Mock the API module
jest.mock('../../api', () => ({
  modelProviderFromConfig: jest.fn(),
  buildApiHandler: jest.fn()
}))

describe('enhancePrompt', () => {
  const mockApiConfig: ModelConfiguration = {
    apiProvider: 'openai',
    openAiApiKey: 'test-key',
    openAiBaseUrl: 'https://api.openai.com/v1'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock the API handler with a completePrompt method
    ;(modelProviderFromConfig as jest.Mock).mockReturnValue({
      completePrompt: jest.fn().mockResolvedValue('Enhanced prompt'),
      createMessage: jest.fn(),
      getModel: jest.fn().mockReturnValue({ 
        id: 'test-model',
        info: {
          maxTokens: 4096,
          contextWindow: 8192,
          supportsPromptCache: false
        }
      })
    } as unknown as SingleCompletionHandler)
  })

  it('enhances prompt using default enhancement prompt when no custom prompt provided', async () => {
    const result = await enhancePrompt(mockApiConfig, 'Test prompt')
    
    expect(result).toBe('Enhanced prompt')
    const handler = modelProviderFromConfig(mockApiConfig)
    expect((handler as any).completePrompt).toHaveBeenCalledWith(
      `${defaultPrompts.enhance}\n\nTest prompt`
    )
  })

  it('enhances prompt using custom enhancement prompt when provided', async () => {
    const customEnhancePrompt = 'You are a custom prompt enhancer'
    
    const result = await enhancePrompt(mockApiConfig, 'Test prompt', customEnhancePrompt)
    
    expect(result).toBe('Enhanced prompt')
    const handler = modelProviderFromConfig(mockApiConfig)
    expect((handler as any).completePrompt).toHaveBeenCalledWith(
      `${customEnhancePrompt}\n\nTest prompt`
    )
  })

  it('throws error for empty prompt input', async () => {
    await expect(enhancePrompt(mockApiConfig, '')).rejects.toThrow('No prompt text provided')
  })

  it('throws error for missing API configuration', async () => {
    await expect(enhancePrompt({} as ModelConfiguration, 'Test prompt')).rejects.toThrow('No valid API configuration provided')
  })

  it('throws error for API provider that does not support prompt enhancement', async () => {
    (modelProviderFromConfig as jest.Mock).mockReturnValue({
      // No completePrompt method
      createMessage: jest.fn(),
      getModel: jest.fn().mockReturnValue({ 
        id: 'test-model',
        info: {
          maxTokens: 4096,
          contextWindow: 8192,
          supportsPromptCache: false
        }
      })
    })

    await expect(enhancePrompt(mockApiConfig, 'Test prompt')).rejects.toThrow('The selected API provider does not support prompt enhancement')
  })

  it('uses appropriate model based on provider', async () => {
    const openRouterConfig: ModelConfiguration = {
      apiProvider: 'openrouter',
      openRouterApiKey: 'test-key',
      openRouterModelId: 'test-model'
    }

    // Mock successful enhancement
    ;(modelProviderFromConfig as jest.Mock).mockReturnValue({
      completePrompt: jest.fn().mockResolvedValue('Enhanced prompt'),
      createMessage: jest.fn(),
      getModel: jest.fn().mockReturnValue({ 
        id: 'test-model',
        info: {
          maxTokens: 4096,
          contextWindow: 8192,
          supportsPromptCache: false
        }
      })
    } as unknown as SingleCompletionHandler)

    const result = await enhancePrompt(openRouterConfig, 'Test prompt')
    
    expect(modelProviderFromConfig).toHaveBeenCalledWith(openRouterConfig)
    expect(result).toBe('Enhanced prompt')
  })

  it('propagates API errors', async () => {
    (modelProviderFromConfig as jest.Mock).mockReturnValue({
      completePrompt: jest.fn().mockRejectedValue(new Error('API Error')),
      createMessage: jest.fn(),
      getModel: jest.fn().mockReturnValue({ 
        id: 'test-model',
        info: {
          maxTokens: 4096,
          contextWindow: 8192,
          supportsPromptCache: false
        }
      })
    } as unknown as SingleCompletionHandler)

    await expect(enhancePrompt(mockApiConfig, 'Test prompt')).rejects.toThrow('API Error')
  })
})