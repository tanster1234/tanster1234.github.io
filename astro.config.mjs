// @ts-check
import { defineConfig } from 'astro/config';

// User site on GitHub Pages; swap `site` to https://tanmayb.dev once the custom domain is set up.
export default defineConfig({
  site: 'https://tanster1234.github.io',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
});
