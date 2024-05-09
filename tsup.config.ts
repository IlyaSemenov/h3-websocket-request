import { defineConfig } from "tsup"

export default defineConfig({
  clean: true,
  entry: {
    "index": "src/index.ts",
    "client/index": "src/client/index.ts",
  },
  format: ["cjs", "esm"],
  sourcemap: true,
  dts: true,
})
