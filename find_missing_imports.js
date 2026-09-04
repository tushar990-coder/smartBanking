const fs = require('fs');
const path = require('path');
const srcDir = 'd:/Bhisi Software/client/src';
let missingCount = 0;
function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      walkSync(dirFile, filelist);
    } else {
      filelist.push(dirFile);
    }
  });
  return filelist;
}
const files = walkSync(srcDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const importRegex = /import.*?from\s+['"](.*?)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      const resolved = path.resolve(path.dirname(file), importPath);
      let found = false;
      const extensions = ['.tsx', '.ts', '.js', '.jsx', '.css', '.scss', '/index.tsx', '/index.ts', ''];
      for (const ext of extensions) {
        if (fs.existsSync(resolved + ext)) {
          found = true;
          break;
        }
      }
      if (!found) {
        console.log('Missing import in ' + file + ': ' + importPath);
        missingCount++;
      }
    }
  }
});
console.log('Total missing frontend imports: ' + missingCount);
