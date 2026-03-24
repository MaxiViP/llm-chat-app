import axios from 'axios'
import {
  setProvider,
  getProvider,
  getProviderLimits,
  sendMessage,
  sendMessageStream,
  isResponseValid,
  getFallbackResponse,
  getAvailableModels,
} from '@/services/llm'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

// mock fetch
global.fetch = jest.fn()

describe('LLM Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setProvider('groq')
  })

  // ------------------------
  // PROVIDER
  // ------------------------
  it('должен переключать провайдера', () => {
    setProvider('openrouter')
    const provider = getProvider()

    expect(provider.key).toBe('openrouter')
  })

  it('лимиты openrouter уменьшаются', () => {
    setProvider('openrouter')
    const before = getProviderLimits()

    expect(before.perMinute).toBeLessThanOrEqual(20)
  })

  // ------------------------
  // MODELS
  // ------------------------
  it('должен получать список моделей', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        data: [{ id: 'model-1' }, { id: 'model-2' }],
      },
    })

    const models = await getAvailableModels('groq')

    expect(models.length).toBe(2)
    expect(models[0].value).toBe('model-1')
  })

  it('возвращает пустой список при ошибке', async () => {
    mockedAxios.get.mockRejectedValue(new Error('fail'))

    const models = await getAvailableModels('groq')

    expect(models).toEqual([])
  })

  // ------------------------
  // STREAM
  // ------------------------
  it('должен стримить ответ', async () => {
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n'),
        })
        .mockResolvedValueOnce({
          done: true,
        }),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    })

    let result = ''

    await sendMessageStream([{ role: 'user', content: 'hi' }], 'llama-3.1-8b-instant', (chunk) => {
      result += chunk
    })

    expect(result).toBe('Hello')
  })

  it('должен кидать ошибку при failed fetch', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'error',
    })

    await expect(
      sendMessageStream([{ role: 'user', content: 'hi' }], 'test', () => {}),
    ).rejects.toThrow()
  })

  // ------------------------
  // sendMessage
  // ------------------------
  it('sendMessage должен собрать полный ответ', async () => {
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n'),
        })
        .mockResolvedValueOnce({
          done: true,
        }),
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    })

    const result = await sendMessage([{ role: 'user', content: 'hi' }], 'test')

    expect(result).toBe('Hi')
  })

  // ------------------------
  // VALIDATION
  // ------------------------
  it('isResponseValid возвращает true для нормального текста', () => {
    expect(isResponseValid('Это нормальный ответ')).toBe(true)
  })

  it('isResponseValid возвращает false для короткого ответа', () => {
    expect(isResponseValid('ok')).toBe(false)
  })

  it('isResponseValid фильтрует мусор', () => {
    expect(isResponseValid('👍')).toBe(false)
    expect(isResponseValid('да')).toBe(false)
  })

  // ------------------------
  // FALLBACK
  // ------------------------
  it('getFallbackResponse возвращает строку', () => {
    const res = getFallbackResponse('test input')

    expect(typeof res).toBe('string')
    expect(res.length).toBeGreaterThan(10)
  })
})
