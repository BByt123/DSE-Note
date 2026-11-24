import {cp, lstat, mkdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const destination = path.resolve(projectRoot, 'dist');
const previousBuild = await lstat(destination).catch(error => {
  if (error.code !== 'ENOENT') throw error;
});
if (previousBuild && !previousBuild.isDirectory()) {
  throw new Error(`Expected a build directory at ${destination}`);
}

// Keep the published layout identical to the source so document-relative URLs work.
const siteEntries = [
  'index.html', 'hub.mjs', 'styles.css',
  'biology-index.html', 'app.mjs', 'biology',
  'economics.html', 'economics-app.mjs', 'economics',
  'lib.mjs', 'rendering.mjs', 'word-preview.mjs', 'exports.mjs',
  'preferences.mjs', 'taxonomy.mjs', 'assets', 'vendor', 'bank',
];

await rm(destination, {recursive: true, force: true});
await mkdir(destination);
for (const entry of siteEntries) {
  await cp(path.join(projectRoot, entry), path.join(destination, entry), {recursive: true});
}
await writeFile(path.join(destination, '.nojekyll'), '');
console.log('Built DSE Study Library in QB/dist.');
