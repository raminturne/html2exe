#!/usr/bin/env node
// Convert an HTML/CSS/JS folder into a standalone Windows .exe (portable, no prerequisites).
// Usage: node build.js --input <siteFolder> [--name "App Name"] [--icon icon.ico] [--output ./output]

// When this script is run via Electron's bundled Node (ELECTRON_RUN_AS_NODE,
// used by the packaged app so end users don't need Node.js installed),
// Electron's fs patches otherwise intercept any path containing ".asar" as a
// virtual archive — which breaks electron-builder writing a real, brand new
// app.asar file to disk. This disables that interception; it's a no-op under
// plain Node.
if (process.versions.electron) {
  process.noAsar = true;
}

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function parseArgs(argv) {
  const args = { output: path.join(__dirname, 'output') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input') args.input = argv[++i];
    else if (a === '--name') args.name = argv[++i];
    else if (a === '--icon') args.icon = argv[++i];
    else if (a === '--output') args.output = argv[++i];
  }
  return args;
}

function sanitizeName(name) {
  return name.replace(/[^\w\- ؀-ۿ]/g, '').trim() || 'App';
}

// fs.cpSync's built-in recursive copy is unreliable here when this script
// runs under Electron's bundled Node (ELECTRON_RUN_AS_NODE) — it intermittently
// throws ENOTDIR partway through large trees like a bundled node_modules. A
// plain hand-rolled walk avoids whatever edge case that hits.
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (entry.isFile()) {
      try {
        fs.copyFileSync(srcPath, destPath);
      } catch (err) {
        // Electron's own runtime specially intercepts a couple of internal
        // filenames (e.g. default_app.asar) when this script runs under its
        // bundled Node — those aren't needed by the generated app, so skip
        // rather than fail the whole build over them.
        console.warn(`Skipped unreadable file: ${srcPath} (${err.code || err.message})`);
      }
    }
  }
}

// Each generated app needs its own isolated userData folder (Electron uses
// package.json's "name" for that path), so this must be unique per app and
// npm-safe (ascii, lowercase). It's derived from appName so rebuilding the
// same app keeps the same data folder instead of orphaning it.
function packageIdFor(appName) {
  const slug = appName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const hash = crypto.createHash('sha1').update(appName).digest('hex').slice(0, 8);
  return `${slug || 'app'}-${hash}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('Usage: node build.js --input <siteFolder> [--name "App Name"] [--icon icon.ico] [--output ./output]');
    process.exit(1);
  }

  const inputDir = path.resolve(args.input);
  if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
    console.error(`Input folder not found: ${inputDir}`);
    process.exit(1);
  }

  const templateDir = path.join(__dirname, 'template');
  if (!fs.existsSync(path.join(templateDir, 'node_modules'))) {
    console.log('Installing template dependencies (first run only)...');
    execSync('npm install', { cwd: templateDir, stdio: 'inherit' });
  }

  const appName = sanitizeName(args.name || path.basename(inputDir));
  const buildDir = path.join(__dirname, '.build-tmp');

  console.log(`Preparing build for "${appName}"...`);
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  // Copy template (including node_modules) into the temp build dir.
  copyDirSync(templateDir, buildDir);

  // Replace the placeholder app/ folder with the user's site.
  const appDir = path.join(buildDir, 'app');
  fs.rmSync(appDir, { recursive: true, force: true });
  copyDirSync(inputDir, appDir);

  // Patch package.json with the app name and optional icon.
  const pkgPath = path.join(buildDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.name = packageIdFor(appName);
  pkg.productName = appName;
  pkg.build.productName = appName;
  pkg.build.portable.artifactName = '${productName}.exe';

  if (args.icon) {
    const iconAbs = path.resolve(args.icon);
    if (!fs.existsSync(iconAbs)) {
      console.error(`Icon file not found: ${iconAbs}`);
      process.exit(1);
    }
    fs.copyFileSync(iconAbs, path.join(buildDir, 'icon.ico'));
    pkg.build.win.icon = 'icon.ico';
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  const outputDir = path.resolve(args.output);
  fs.mkdirSync(outputDir, { recursive: true });
  pkg.build.directories = { output: outputDir };
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  console.log('Building portable .exe (this can take a minute)...');
  // Invoked programmatically (not via `npx electron-builder`) so this works
  // even on end-user machines that have no Node.js/npm installed at all —
  // see main.js, which runs this script itself via Electron's own bundled
  // Node when packaged.
  const builder = require(path.join(buildDir, 'node_modules', 'electron-builder'));
  await builder.build({
    targets: builder.Platform.WINDOWS.createTarget(['portable'], builder.Arch.x64),
    projectDir: buildDir,
  });

  fs.rmSync(buildDir, { recursive: true, force: true });

  console.log(`\nDone. Your app is here: ${path.join(outputDir, appName + '.exe')}`);
}

main().catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});
