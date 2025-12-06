#!/usr/bin/env node

/**
 * Build script for realtime-voice-translation
 * Provides utilities for building and packaging the application
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    log(`\n> ${command}`, colors.blue);
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    log(`Error executing: ${command}`, colors.red);
    return false;
  }
}

function checkPrerequisites() {
  log('\n=== Checking Prerequisites ===', colors.bright);
  
  const checks = [
    { cmd: 'node --version', name: 'Node.js' },
    { cmd: 'npm --version', name: 'npm' },
    { cmd: 'rustc --version', name: 'Rust' },
    { cmd: 'cargo --version', name: 'Cargo' },
  ];

  let allPassed = true;
  for (const check of checks) {
    try {
      const result = execSync(check.cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const version = result.trim();
      log(`✓ ${check.name}: ${version}`, colors.green);
    } catch (error) {
      log(`✗ ${check.name}: Not found`, colors.red);
      allPassed = false;
    }
  }

  return allPassed;
}

function cleanBuild() {
  log('\n=== Cleaning Build Artifacts ===', colors.bright);
  
  const dirsToClean = [
    'dist',
    'src-tauri/target/release',
    'src-tauri/target/debug',
  ];

  for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
      log(`Removing ${dir}...`, colors.yellow);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  
  log('✓ Clean complete', colors.green);
}

function runTests() {
  log('\n=== Running Tests ===', colors.bright);
  return exec('npm test');
}

function buildFrontend() {
  log('\n=== Building Frontend ===', colors.bright);
  return exec('npm run build:optimize');
}

function buildTauri(target = null) {
  log('\n=== Building Tauri Application ===', colors.bright);
  
  let command = 'npm run tauri:build';
  if (target) {
    command += ` -- --target ${target}`;
  }
  
  return exec(command);
}

function getBuildInfo() {
  const rootDir = path.join(__dirname, '..');
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
  );
  const version = packageJson.version;
  
  return {
    name: packageJson.name,
    version,
    description: packageJson.description,
  };
}

function showBuildArtifacts() {
  log('\n=== Build Artifacts ===', colors.bright);
  
  const bundleDir = 'src-tauri/target/release/bundle';
  
  if (!fs.existsSync(bundleDir)) {
    log('No build artifacts found', colors.yellow);
    return;
  }

  function listFiles(dir, indent = '') {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        log(`${indent}📁 ${item}/`, colors.blue);
        listFiles(fullPath, indent + '  ');
      } else {
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        log(`${indent}📄 ${item} (${sizeMB} MB)`, colors.green);
      }
    }
  }

  listFiles(bundleDir);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'build';

  log('\n╔════════════════════════════════════════╗', colors.bright);
  log('║  实时语音翻译 - Build Script          ║', colors.bright);
  log('╚════════════════════════════════════════╝', colors.bright);

  const info = getBuildInfo();
  log(`\nVersion: ${info.version}`, colors.blue);
  log(`Description: ${info.description}`, colors.blue);

  switch (command) {
    case 'check':
      checkPrerequisites();
      break;

    case 'clean':
      cleanBuild();
      break;

    case 'test':
      if (!runTests()) {
        process.exit(1);
      }
      break;

    case 'build':
      if (!checkPrerequisites()) {
        log('\n✗ Prerequisites check failed', colors.red);
        process.exit(1);
      }
      
      if (!runTests()) {
        log('\n✗ Tests failed', colors.red);
        process.exit(1);
      }
      
      if (!buildFrontend()) {
        log('\n✗ Frontend build failed', colors.red);
        process.exit(1);
      }
      
      if (!buildTauri()) {
        log('\n✗ Tauri build failed', colors.red);
        process.exit(1);
      }
      
      showBuildArtifacts();
      log('\n✓ Build complete!', colors.green);
      break;

    case 'build:windows':
      buildTauri('x86_64-pc-windows-msvc');
      showBuildArtifacts();
      break;

    case 'build:linux':
      buildTauri('x86_64-unknown-linux-gnu');
      showBuildArtifacts();
      break;

    case 'artifacts':
      showBuildArtifacts();
      break;

    case 'help':
    default:
      log('\nUsage: node scripts/build.js [command]', colors.blue);
      log('\nCommands:', colors.bright);
      log('  check          - Check prerequisites');
      log('  clean          - Clean build artifacts');
      log('  test           - Run tests');
      log('  build          - Full build (default)');
      log('  build:windows  - Build for Windows');
      log('  build:linux    - Build for Linux');
      log('  artifacts      - Show build artifacts');
      log('  help           - Show this help');
      break;
  }
}

main();
