import { defineConfig } from 'vite';

// Relative base so the build works at any path: /static/cv/ in the Bridge preview, or a subfolder of the blog.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // One JS and one CSS file: the Bridge preview proxy dislikes many parallel requests.
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
