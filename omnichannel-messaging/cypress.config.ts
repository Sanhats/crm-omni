import { defineConfig } from "cypress"

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    setupNodeEvents(on, config) {
      // Implementar event listeners de Node.js
    },
  },
  component: {
    devServer: {
      framework: "next",
      bundler: "webpack",
    },
  },
})

