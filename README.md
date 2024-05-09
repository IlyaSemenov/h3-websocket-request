# h3-websocket-request

Define `h3` request handler where the server can request additional data from the client during processing of the request, such as asking the client to sign a web3 transaction. Uses `defineWebSocketHandler` under the hood.

## Install

```sh
npm install h3-websocket-request
```

## Use

Create `server/api/my-handler.ts`:

```ts
import { defineWebsocketRequestHandler } from "h3-websocket-request"

export default defineWebsocketRequestHandler<{ input: string }>(async (ctx) => {
  // Use client-provided data.
  const tx = await prepareTransaction(ctx.data.input)
  // Request the client to additionally process server-generated data.
  const signedTx = await ctx.callback(tx)
  const txId = await blockchain.push(signedTx)
  // Return result to the client.
  return { txId }
})
```

In the client-side code, call the handler with:

```ts
import { defineNamedRequestCallbacks, websocketRequest } from "h3-websocket-request/client"

const { txId } = await websocketRequest<{ txId: string }>(
  "/my-handler",
  { input: "user input" },
  async (tx) => {
    const signedTx = await wallet.signTransaction(tx)
    return signedTx
  }
)
```

## Named callbacks

Within the handler, you may want to run different callbacks with:

```ts
const signedTx = await ctx.callback(["sign", tx])
const signedTxs = await ctx.callback(["signMany", txs])
```

In the client-side code, define named handlers:

```ts
const { txId } = await websocketRequest<{ txId: string }>(
  "/my-handler",
  { input: "user input" },
  defineNamedRequestCallbacks({
    async sign(tx) {
      // ...
    },
    async signMany(txs) {
      // ...
    }
  }),
)
```
