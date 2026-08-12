import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');

console.log('🚀 Launching God-Caliber Dev Server + Automated Cloudflare Tunnel...\n');

// 1. Clear any existing temporary .env.local
try {
  if (fs.existsSync(envLocalPath)) {
    fs.unlinkSync(envLocalPath);
  }
} catch (e) {}

let viteProcess = null;
let tunnelUrl = null;

// 2. Spawn Cloudflare Tunnel process
const cloudflared = spawn('npx', ['cloudflared', 'tunnel', '--url', 'http://localhost:5173'], {
  cwd: rootDir,
  shell: true
});

const urlRegex = /(https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com)/;

function handleOutput(data) {
  const str = data.toString();
  const match = str.match(urlRegex);
  if (match && !tunnelUrl) {
    tunnelUrl = match[1];
    console.log(`\n===============================================================`);
    console.log(`🌐 CLOUDFLARE TUNNEL ONLINE: ${tunnelUrl}`);
    console.log(`🎮 VITE DEV SERVER:          http://localhost:5173`);
    console.log(`👉 In-game "COPY INVITE LINK" will now automatically use the tunnel URL!`);
    console.log(`===============================================================\n`);

    // Write VITE_TUNNEL_URL to .env.local for Vite to pick up
    fs.writeFileSync(envLocalPath, `VITE_TUNNEL_URL=${tunnelUrl}\n`);

    // Start Vite Dev Server
    startVite();
  }
}

cloudflared.stdout.on('data', handleOutput);
cloudflared.stderr.on('data', handleOutput);

function startVite() {
  if (viteProcess) return;
  viteProcess = spawn('npx', ['vite', '--host'], {
    cwd: rootDir,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, VITE_TUNNEL_URL: tunnelUrl }
  });
}

// Cleanup on exit
function cleanup() {
  console.log('\n🛑 Shutting down Dev Server & Cloudflare Tunnel...');
  try {
    if (fs.existsSync(envLocalPath)) fs.unlinkSync(envLocalPath);
  } catch (e) {}
  try { cloudflared.kill(); } catch (e) {}
  try { if (viteProcess) viteProcess.kill(); } catch (e) {}
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
