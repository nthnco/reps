import { defineConfig } from '@hey-api/openapi-ts'

// Generates TypeScript types (only types, no API client) from the backend's
// OpenAPI schema. Regenerate with `npm run gen:api` after changing the API.
export default defineConfig({
  input: 'openapi.json',
  output: 'src/api/generated',
  plugins: ['@hey-api/typescript'],
})
