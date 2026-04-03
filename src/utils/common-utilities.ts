// src/utils/common-utilities.ts

export const getProgressColor = (percent: number): string => {
  if (percent > 50) return '#34D399' // Green - high completion
  if (percent > 20) return '#FBBF24' // Yellow - moderate completion
  return '#F87171' // Red - low completion
}

export const truncate = (text: string, maxLength = 40): string => {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
}

export const calculateUsagePercentage = (used: number, total: number): number => {
  if (total === 0) return 0
  return Math.max(0, Math.min(100, (used / total) * 100))
}

export const formatPercentage = (value: number): string => {
  return `${Math.round(value)}%`
}

export const isResponseValid = (content: string): boolean => {
  if (!content || content.trim().length < 10) return false

  const invalidResponses = new Set([
    '...',
    '😊',
    '👍',
    '✅',
    '❌',
    'да',
    'нет',
    'ok',
    'хорошо',
    'плохо',
    'норм',
  ])

  return !invalidResponses.has(content.trim().toLowerCase())
}

export const getFallbackMessage = (userInput: string): string => {
  const maxLength = 100
  return `Извините, в данный момент сервис временно недоступен. Попробуйте позже. Ваш запрос: "${userInput.slice(0, maxLength)}${userInput.length > maxLength ? '...' : ''}"`
}

export const handleError = (error: Error, context: string): void => {
  console.error(`❌ Ошибка в ${context}:`, error.message)
  if (error.message.includes('429') || error.message.includes('rate_limit')) {
    console.warn('⏳ Лимит запросов превышен, попробуйте снова позже.')
  } else if (error.message.includes('404')) {
    console.warn('❓ Ресурс не найден, проверьте URL или данные.')
  }
}

export const warn = (message: string): void => {
  console.warn(`⚠️ Предупреждение: ${message}`)
}
