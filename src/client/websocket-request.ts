import type { ClientFrame, ServerFrame } from "../websocket-request-handler"

export type RequestCallback = (data: any) => any

export async function websocketRequest<T>(path: string, data?: any, callback?: RequestCallback): Promise<T> {
  const url = path.startsWith("/") ? (location.origin.replace(/^http/, "ws") + path) : path
  const ws = new WebSocket(url)
  const send = (frame: ClientFrame) => ws.send(JSON.stringify(frame))
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("error", reject)
    ws.addEventListener("open", () => {
      ws.removeEventListener("error", reject)
      resolve()
    })
  })
  return await new Promise((resolve, reject) => {
    ws.addEventListener("error", reject)
    ws.addEventListener("close", ({ code, reason }) => {
      reject(reason ?? `Websocket closed (code ${code}).`)
    })
    ws.addEventListener("message", async (message) => {
      const frame = JSON.parse(message.data) as ServerFrame
      if (frame._ === "callback") {
        if (callback) {
          await Promise.resolve(callback(frame.data)).then((res) => {
            send({ _: "callback", data: res })
          }, (error) => {
            send({ _: "callback", error: `${error}` })
          })
        } else {
          send({ _: "callback", error: `No callback defined.` })
        }
      } else if (frame._ === "return") {
        if ("error" in frame) {
          reject(frame.error)
        } else {
          resolve(frame.data as T)
        }
      }
    })
    // Send data with the first frame.
    send({ _: "start", data })
  })
}
