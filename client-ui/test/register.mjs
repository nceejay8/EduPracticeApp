// Lets Node import the app's data modules directly, so the syllabus tests can
// run without a bundler or a test framework.
//
// Two small gaps between Vite and plain Node have to be bridged:
//   1. Vite resolves './syllabus' to './syllabus.js'; Node requires the extension.
//   2. Some modules read `import.meta.env`, which only exists under a bundler.
import { register } from 'node:module';

register(new URL('./hooks.mjs', import.meta.url));
