/**
 * Implementa un mecanismo de reintento con backoff exponencial
 * @param fn Función a reintentar
 * @param maxRetries Número máximo de reintentos
 * @param baseDelay Retraso base en milisegundos
 * @param maxDelay Retraso máximo en milisegundos
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  baseDelay = 1000,
  maxDelay = 60000,
): Promise<T> {
  let retries = 0
  let lastError: Error

  while (retries <= maxRetries) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Si es el último reintento, lanzar el error
      if (retries === maxRetries) {
        throw lastError
      }

      // Calcular el retraso con jitter para evitar sincronización
      const delay = Math.min(maxDelay, baseDelay * Math.pow(2, retries) * (0.5 + Math.random() * 0.5))

      console.log(`Reintento ${retries + 1}/${maxRetries} después de ${delay}ms`)

      // Esperar antes del siguiente reintento
      await new Promise((resolve) => setTimeout(resolve, delay))

      retries++
    }
  }

  // Este punto nunca debería alcanzarse debido al throw en el último reintento
  throw lastError!
}

/**
 * Calcula el tiempo para el próximo reintento basado en el número de intentos
 * @param retryCount Número actual de reintentos
 * @param baseDelay Retraso base en milisegundos
 * @param maxDelay Retraso máximo en milisegundos
 */
export function calculateNextRetryTime(
  retryCount: number,
  baseDelay = 1000,
  maxDelay: number = 60000 * 60, // 1 hora máximo
): Date {
  const delay = Math.min(maxDelay, baseDelay * Math.pow(2, retryCount) * (0.5 + Math.random() * 0.5))

  return new Date(Date.now() + delay)
}

