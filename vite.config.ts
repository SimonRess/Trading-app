import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '$game': '/src/game',
      '$ui': '/src/ui',
      '$render': '/src/render',
    },
  },
});
