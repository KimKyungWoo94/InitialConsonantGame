import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dictionaryApiPlugin } from './vite.dictionary-plugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss(), dictionaryApiPlugin(env.STDICT_API_KEY)],
    server: {
      host: true,
    },
  }
})
