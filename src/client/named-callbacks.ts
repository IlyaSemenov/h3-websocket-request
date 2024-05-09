import type { RequestCallback } from "./websocket-request"

export type NamedRequestCallback = (...args: any[]) => any

export type NamedRequestCallbacks = Partial<Record<string, NamedRequestCallback>>

/**
 * Create client-side callback handler that handles callback frames in the format: `[callbackName, ...args]`
 * and passes args to the respectfully named function in `callbacks`.
 */
export function defineNamedRequestCallbacks(callbacks: NamedRequestCallbacks): RequestCallback {
  return (data) => {
    const [method, ...args] = data as [string, ...unknown[]]
    const callback = callbacks[method]
    if (!callback) {
      throw new Error(`Unknown callback: ${method}`)
    }
    return callback(...args)
  }
}
