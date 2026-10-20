import { defineConfig } from 'astro/config';

// One static site for GitHub Pages. 'preserve' keeps output paths as the source names them,
// so pages/writing.astro would become /writing.html and posts/<slug>/index.astro /posts/<slug>/.
// SITE_BASE serves the build from a subfolder, such as the private preview under /static/cv/.
export default defineConfig({
  site: 'https://minwahleung.ca',
  base: process.env.SITE_BASE ?? '/',
  output: 'static',
  outDir: 'dist',
  trailingSlash: 'ignore',
  build: { format: 'preserve' },
});
