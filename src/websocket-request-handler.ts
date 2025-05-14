import { defineWebSocketHandler } from "h3"

// Pull Websocket types, see https://github.com/unjs/h3/issues/716
export type Peer = Parameters<NonNullable<Parameters<typeof defineWebSocketHandler>[0]["open"]>>[0]
export type Message = Parameters<NonNullable<Parameters<typeof defineWebSocketHandler>[0]["message"]>>[1]

const ctxSymbol = Symbol("WebsocketRequestPeerContext")

export type WebsocketRequestPeer = Peer & {
  [ctxSymbol]?: WebsocketRequestPeerContext
}

export interface WebsocketRequestPeerContext {
  /** Active request handler.  */
  promise?: Promise<unknown>
  /** Active client callback (can only be one at the moment, but this could be reworked to be a list). */
  callback?: {
    resolve: (data: any) => void
    reject: (reason?: any) => void
  }
}

/**
 * The actual request handler (can work relatively long, wait for client callbacks
 */
export type WebsocketRequestHandler<T> = (ctx: WebsocketRequestContext<T>) => Promise<any>

export interface WebsocketRequestContext<T> {
  peer: WebsocketRequestPeer
  /** Initial frame. */
  data: T
  /** Run client-side callback. */
  callback: ClientCallback
}

export type ClientCallback = <T>(data: any) => Promise<T>

export type ClientFrame = {
  _: "start"
  data: unknown
} | {
  _: "callback"
  data?: unknown
  error?: string
}

export type ServerFrame = {
  _: "callback"
  data: unknown
} | {
  _: "return"
  data?: unknown
  error?: string
}

/**
 * Create websocket request handler.
 *
 * The handler will be able to call client-side callbacks.
 */
export function defineWebsocketRequestHandler<T>(handler: WebsocketRequestHandler<T>) {
  return defineWebSocketHandler({
    open(peer: WebsocketRequestPeer) {
      peer[ctxSymbol] = {}
    },

    message(peer: WebsocketRequestPeer, message) {
      const ctx = peer[ctxSymbol]!
      const frame = JSON.parse(message.text()) as ClientFrame
      const send = (frame: ServerFrame) => peer.send(JSON.stringify(frame))
      if (frame._ === "start") {
        if (ctx.promise) {
          throw new Error("RPC has been already started.")
        }
        /** Callback that runs client-side callback. */
        const callback = (data: any): Promise<any> => {
          if (ctx.callback) {
            throw new Error("There is an unfinished callback running.")
          }
          return new Promise((resolve, reject) => {
            ctx.callback = {
              resolve(data: any) {
                delete ctx.callback
                resolve(data)
              },
              reject(err: Error) {
                delete ctx.callback
                reject(err)
              },
            }
            send({ _: "callback", data })
            // response will be passed to ctx.callback.resolve()
          })
        }
        ctx.promise = handler({ peer, data: frame.data as T, callback }).then((data) => {
          send({ _: "return", data })
          // 1000 indicates a normal closure, meaning that the purpose for
          // which the connection was established has been fulfilled.
          peer.close(1000)
        }, (error) => {
          send({ _: "return", error: `${error}` })
          // Status codes in the range 4000-4999 are reserved for private use.
          peer.close(4000, "Unhandled exception in RPC handler.")
        })
      } else if (frame._ === "callback") {
        // Response from client-side callback.
        if (!ctx.callback) {
          throw new Error("There is no callback running.")
        }
        if ("error" in frame) {
          ctx.callback.reject(frame.error)
        } else {
          ctx.callback.resolve(frame.data)
        }
      }
    },

    close(peer: WebsocketRequestPeer) {
      peer[ctxSymbol]?.callback?.reject("Connection closed.")
    },

    error(peer: WebsocketRequestPeer, error) {
      peer[ctxSymbol]?.callback?.reject(error)
    },
  })
}
