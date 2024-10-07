import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    https:true
  },
  build: { 
    lib: {
        name:"WeightxrepsOAuth",
        formats: ['es', 'cjs'],  
        entry: resolve(__dirname, 'src/library-index.ts'), 
        fileName: (format) => `weightxreps-oauth.${format}.js`
    },
    rollupOptions: {
        // make sure to externalize deps that shouldn't be bundled
        // into your library
        external: ['react'],
        output: {
          // Provide global variables to use in the UMD build
          // for externalized deps
          globals: {
            vue: 'React',
          },
        },
      },
  }
})
