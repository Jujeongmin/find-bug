import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // the Agent8 SDK pulls its own React copy through Vite's dep pre-bundling;
  // deduping keeps one instance so hooks resolve
  resolve: { dedupe: ["react", "react-dom"] },
  // pre-bundle the SDK together with React so dev serves a single React copy;
  // leaving them in separate graphs gave the SDK its own and broke hooks
  optimizeDeps: {
    include: ["@agent8/gameserver", "react", "react-dom", "react/jsx-runtime"],
  },
})
