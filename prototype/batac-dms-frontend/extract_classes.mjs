import fs from 'fs';
import path from 'path';

const regex = /bg-[a-z0-9#-]*|text-[a-z0-9#-]*|border-[a-z0-9#-]*|ring-[a-z0-9#-]*|rounded-[a-z]*|shadow-[a-z]*/g;
const srcDir = './src';
const counts = {};

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.match(/\.(js|jsx|ts|tsx|html|css)$/)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = content.match(regex);
      if (matches) {
        for (const match of matches) {
          counts[match] = (counts[match] || 0) + 1;
        }
      }
    }
  }
}

walk(srcDir);

const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
for (const [cls, count] of sorted) {
  console.log(`${count.toString().padStart(5)} ${cls}`);
}
