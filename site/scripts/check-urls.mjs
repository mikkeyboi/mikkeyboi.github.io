// Fail the build if a public URL disappears. The GitHub profile README and old links point at
// these paths, so every post folder must still produce /posts/<slug>/index.html.
import { existsSync, readdirSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const posts = readdirSync(new URL('../src/content/posts/', import.meta.url));
const required = ['index.html', 'writing.html', 'about.html', 'playground/index.html', ...posts.map((slug) => `posts/${slug}/index.html`)];
const missing = required.filter((path) => !existsSync(new URL(path, dist)));
if (missing.length) {
  console.error(`missing from dist/: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`all ${required.length} public URLs present`);
