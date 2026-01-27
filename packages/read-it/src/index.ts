import type { PathLike } from "node:fs";

import { readdir } from "node:fs/promises";
import { cwd } from "node:process";

import { join } from 'node:path';

const pwd: PathLike = cwd();
const IGNORE_DIRS = ['.git', '.yarn', 'node_modules', 'dist', '.cache'];

async function* walkDir(pwd: PathLike): AsyncGenerator<any, any, unknown> {
  const entries = await readdir(pwd, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(pwd as string, entry.name);
    
    // Skip ignored directories
    if (entry.isDirectory() && IGNORE_DIRS.includes(entry.name)) {
      continue;
    }
    
    yield fullPath;
    
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    }
  }
}

// Usage
for await (const path of walkDir(pwd)) {
  console.log(path);
}

//const pwd: PathLike = cwd();
//
//try {
//    const files = await readdir(pwd, { recursive: true });
//    for (const file of files) console.log(file);
//} catch (err) {
//    console.error(err);
//}
