import { defineConfig } from 'vite';

// The existing vanilla app (css/js/vendor/assets) lives under public/ and is
// served verbatim at the site root, so the legacy `<script src="js/...">` tags
// keep resolving unchanged. Only src/main.ts (and its TS imports) is bundled.
export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
