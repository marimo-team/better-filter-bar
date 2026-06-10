import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  pack: {
    entry: {
      index: "./src/index.ts",
      "react/index": "./src/react/index.ts",
    },
    dts: {
      tsgo: true,
    },
    exports: true,
    deps: {
      neverBundle: ["react", "react-dom", "react/jsx-runtime"],
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
