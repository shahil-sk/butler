import fs from 'fs';
import path from 'path';

const SRC_DIR = './src/modules';

function scanDir(dir, result) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, result);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      result.files.push(fullPath);
      result.loc += content.split('\n').length;
      
      const todos = (content.match(/TODO|FIXME/gi) || []).length;
      const comingSoon = (content.match(/coming soon/gi) || []).length;
      const notImplemented = (content.match(/not implemented/gi) || []).length;
      
      if (todos > 0) result.todos.push({ file: fullPath, count: todos });
      if (comingSoon > 0) result.comingSoon.push({ file: fullPath, count: comingSoon });
      if (notImplemented > 0) result.notImplemented.push({ file: fullPath, count: notImplemented });
    }
  }
}

const modules = fs.readdirSync(SRC_DIR).filter(f => fs.statSync(path.join(SRC_DIR, f)).isDirectory());

const report = {};

for (const mod of modules) {
  const modPath = path.join(SRC_DIR, mod);
  const result = { files: [], loc: 0, todos: [], comingSoon: [], notImplemented: [] };
  scanDir(modPath, result);
  report[mod] = result;
}

console.log(JSON.stringify(report, null, 2));
