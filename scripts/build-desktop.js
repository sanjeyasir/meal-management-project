import { execSync } from 'child_process';
import { packager } from '@electron/packager';
import fs from 'fs';
import path from 'path';

async function buildDesktop() {
  console.log('==================================================');
  console.log('🚀 BUILDING HAYLEYS MEAL MANAGEMENT DESKTOP APP');
  console.log('==================================================');

  // 1. Build Vite production web bundle
  console.log('\n[1/4] Building Vite production web bundle...');
  execSync('npm.cmd run web:build', { stdio: 'inherit' });

  // 2. Prepare clean staging directory
  const stagingDir = path.resolve('staging_app');
  const outDir = path.resolve('dist_desktop');

  console.log('\n[2/4] Preparing clean staging distribution...');
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  fs.mkdirSync(stagingDir, { recursive: true });

  // Copy necessary directories
  fs.cpSync(path.resolve('dist'), path.join(stagingDir, 'dist'), { recursive: true });
  fs.cpSync(path.resolve('electron'), path.join(stagingDir, 'electron'), { recursive: true });
  fs.cpSync(path.resolve('server'), path.join(stagingDir, 'server'), { recursive: true });
  fs.cpSync(path.resolve('public'), path.join(stagingDir, 'public'), { recursive: true });

  // Create clean production package.json for the desktop app
  const prodPkg = {
    name: "hayleys-meal-management-system",
    version: "1.0.0",
    main: "electron/main.cjs",
    type: "module",
    dependencies: {
      "cors": "^2.8.5",
      "express": "^4.21.2",
      "ws": "^8.18.1"
    }
  };

  fs.writeFileSync(path.join(stagingDir, 'package.json'), JSON.stringify(prodPkg, null, 2));

  // Install production runtime dependencies in staging
  console.log('\n[3/4] Installing runtime dependencies for embedded middleware...');
  execSync('npm.cmd install --omit=dev --no-audit --no-fund', { cwd: stagingDir, stdio: 'inherit' });

  // 3. Package Electron desktop app
  console.log('\n[4/4] Packaging Windows 64-bit Desktop Executable (.exe)...');
  const appPaths = await packager({
    dir: stagingDir,
    name: 'Hayleys Meal Management System',
    platform: 'win32',
    arch: 'x64',
    out: 'dist_desktop',
    overwrite: true,
    icon: './public/diet.ico',
    asar: true
  });

  // Clean staging directory
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }

  console.log('\n==================================================');
  console.log('🎉 DESKTOP BUILD SUCCESSFUL!');
  console.log('📁 Output Folder:', appPaths[0]);
  console.log('▶️  Standalone Executable: Hayleys Meal Management System.exe');
  console.log('==================================================');
}

buildDesktop().catch((err) => {
  console.error('Desktop build failed:', err);
  process.exit(1);
});
