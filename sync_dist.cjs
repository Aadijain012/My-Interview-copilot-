const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const srcDist = path.resolve(__dirname, 'dist');
const dest1 = path.resolve(__dirname, '../overlayai/overlay-ai/frontend_dist');
const dest2 = path.resolve(__dirname, 'overlay-ai/frontend_dist');

if (fs.existsSync(dest1)) {
  copyDir(srcDist, dest1);
  console.log('Synced to', dest1);
}
if (fs.existsSync(dest2)) {
  copyDir(srcDist, dest2);
  console.log('Synced to', dest2);
}
