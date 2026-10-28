import { defineConfig } from 'vite'
import oneLine from './plugins/site.ts'

export default defineConfig({
  plugins: [oneLine()],
})
