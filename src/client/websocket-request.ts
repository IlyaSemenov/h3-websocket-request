import type { ClientFrame, ServerFrame } from "../websocket-request-handler"

export type RequestCallback = (data: any) => any

export function websocketRequest<T>(path: string, data?: any, callback?: RequestCallback): Promise<T> {
  const url = path.startsWith("/") ? (location.origin.replace(/^http/, "ws") + path) : path
  const ws = new WebSocket(url)
  const send = (frame: ClientFrame) => ws.send(JSON.stringify(frame))
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      // Send data with the first frame.
      send({ _: "start", data })
    })
    ws.addEventListener("error", () => {
      reject(new Error("Websocket error."))
    })
    ws.addEventListener("close", ({ code, reason }) => {
      // Note: reason could be empty string, use || not ??
      reject(new Error(reason || `Websocket closed (code ${code}).`))
    })
    ws.addEventListener("message", (message) => {
      const frame = JSON.parse(message.data) as ServerFrame
      if (frame._ === "callback") {
        if (callback) {
          Promise.resolve().then(() => callback(frame.data)).then((res) => {
            send({ _: "callback", data: res })
          }, (error) => {
            send({ _: "callback", error: `${error}` })
          })
        } else {
          send({ _: "callback", error: `No callback defined.` })
        }
      } else if (frame._ === "return") {
        if ("error" in frame) {
          reject(new Error(frame.error))
        } else {
          resolve(frame.data as T)
        }
      }
    })
  })
}
