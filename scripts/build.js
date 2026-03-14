const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd) {
  const start = Date.now();
  console.log(`\n[${new Date().toLocaleTimeString()}] > Executing: ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    const end = Date.now();
    console.log(`[${new Date().toLocaleTimeString()}] > Done in ${((end - start) / 1000).toFixed(2)}s`);
  } catch (e) {
    console.error(`\n[ERROR] Command failed: ${cmd}`);
    process.exit(1);
  }
}

console.log('--- RSIQ PRO ENTERPRISE BUILD SYSTEM (OPTIMIZED) ---');

// 0. Cleanup
console.log('\n> Phase 0: Pre-build Integrity Cleanup');
const dirsToClean = ['.next', 'out', 'dist', 'tsconfig.tsbuildinfo'];
dirsToClean.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`  Removing ${dir}...`);
    try {
      if (fs.lstatSync(dir).isDirectory()) {
        fs.rmSync(dir, { recursive: true, force: true });
      } else {
        fs.unlinkSync(dir);
      }
    } catch (err) {
      console.warn(`  [WARN] Failed to remove ${dir}: ${err.message}`);
    }
  }
});

// 1. Prisma steps
console.log('\n> Phase 1: Database & Client Generation');
run('npx prisma generate');
run('npx prisma db push --accept-data-loss');

// 2. Next.js Build
console.log('\n> Phase 2: Next.js Production Compilation');
// NEXT_TELEMETRY_DISABLED helps privacy and sometimes speed
process.env.NEXT_TELEMETRY_DISABLED = '1';
// Disable full static pre-rendering of everything if possible (though standalone usually handles this well)
run('npx next build');

// 3. Post-build Asset Relocation
console.log('\n> Phase 3: Standalone Asset Relocation');
const standalonePath = path.join('.next', 'standalone');
if (fs.existsSync(standalonePath)) {
  const tasks = [
    { src: path.join('.next', 'static'), dest: path.join(standalonePath, '.next', 'static'), type: 'dir' },
    { src: 'public', dest: path.join(standalonePath, 'public'), type: 'dir' },
    { src: 'prisma', dest: path.join(standalonePath, 'prisma'), type: 'dir' },
    { src: '.env', dest: path.join(standalonePath, '.env'), type: 'file' },
    { src: '.env.local', dest: path.join(standalonePath, '.env.local'), type: 'file' }
  ];

  tasks.forEach(({ src, dest, type }) => {
    if (fs.existsSync(src)) {
      console.log(`  Copying ${src} -> ${dest}`);
      const parentDir = path.dirname(dest);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

      try {
        if (type === 'dir') {
          if (fs.cpSync) {
            fs.cpSync(src, dest, { recursive: true, force: true });
          } else {
            const cmd = process.platform === 'win32' 
              ? `xcopy /E /I /Y "${src}" "${dest}"` 
              : `cp -R "${src}" "${dest}"`;
            execSync(cmd);
          }
        } else {
          fs.copyFileSync(src, dest);
        }
      } catch (e) {
        console.warn(`  [WARN] Failed to copy ${src}: ${e.message}`);
      }
    }
  });
} else {
  console.log('  [SKIP] Standalone directory not found.');
}

console.log('\n--- BUILD SUCCESSFUL ---');
console.log(`Final build ready in: ${path.resolve('.next/standalone')}`);
