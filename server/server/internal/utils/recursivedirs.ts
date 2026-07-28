import fs from "node:fs";
import path from "node:path";

export function recursivelyReaddir(dir: string, depth: number = 100) {
  if (depth == 0) return [];
  const result: Array<string> = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const targetDir = path.join(dir, file);
    const stat = fs.lstatSync(targetDir);
    if (stat.isDirectory()) {
      const subdirs = recursivelyReaddir(targetDir, depth - 1);
      result.push(...subdirs);
      continue;
    }
    result.push(targetDir);
  }

  return result;
}
