import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Launching Cloudflare Tunnel & Dual-Browser WAN WebRTC Test...');

let cloudflared = null;
let viteServer = null;

async function runTunnelTest() {
  // Spawn Cloudflare Tunnel process
  console.log('🌐 Requesting automated Cloudflare Tunnel URL...');
  cloudflared = spawn('npx', ['cloudflared', 'tunnel', '--url', 'http://localhost:5173'], {
    cwd: rootDir,
    shell: true
  });

  const urlRegex = /(https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com)/;
  let tunnelUrl = null;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Cloudflare Tunnel timeout after 15s')), 15000);
    const handler = (data) => {
      const str = data.toString();
      const match = str.match(urlRegex);
      if (match && !tunnelUrl) {
        tunnelUrl = match[1];
        clearTimeout(timeout);
        resolve(tunnelUrl);
      }
    };
    cloudflared.stdout.on('data', handler);
    cloudflared.stderr.on('data', handler);
  });

  console.log(`\n===============================================================`);
  console.log(`🌐 CLOUDFLARE TUNNEL ONLINE: ${tunnelUrl}`);
  console.log(`===============================================================\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--allow-insecure-localhost',
      '--disable-web-security'
    ]
  });

  // Page 1: Host connects via Localhost
  console.log('🌐 Opening Browser Page 1 (HOST on Localhost)...');
  const pageHost = await browser.newPage();
  pageHost.on('console', msg => console.log(`[HOST ${msg.type().toUpperCase()}] ${msg.text()}`));
  await pageHost.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await pageHost.waitForSelector('.tab-btn[data-tab="tab-multiplayer"]', { timeout: 10000 });
  await pageHost.click('.tab-btn[data-tab="tab-multiplayer"]');
  await pageHost.waitForSelector('#host-lobby-btn', { visible: true, timeout: 5000 });
  await pageHost.click('#host-lobby-btn');

  await pageHost.waitForFunction(() => {
    return window.gameInstance && window.gameInstance.network && window.gameInstance.network.roomId;
  }, { timeout: 15000 });

  const roomId = await pageHost.evaluate(() => window.gameInstance.network.roomId);
  console.log(`\n👑 LOBBY HOSTED! Room Code: ${roomId}\n`);

  // Page 2: Client connects via WAN Tunnel URL
  const joinUrl = `${tunnelUrl}/?lobby=${encodeURIComponent(roomId)}`;
  console.log(`🌐 Opening Browser Page 2 (CLIENT via Tunnel URL: ${joinUrl})...`);
  const pageClient = await browser.newPage();
  pageClient.on('console', msg => console.log(`[CLIENT ${msg.type().toUpperCase()}] ${msg.text()}`));
  await pageClient.goto(joinUrl, { waitUntil: 'domcontentloaded' });

  // Monitor connection progress for 15s
  let connected = false;
  const startTime = Date.now();
  while (Date.now() - startTime < 15000) {
    const hostState = await pageHost.evaluate(() => window.gameInstance?.network?.connections?.size || 0);
    const clientState = await pageClient.evaluate(() => window.gameInstance?.network?.isConnected);

    console.log(`📊 t+${Math.round((Date.now() - startTime)/1000)}s | Host peers: ${hostState} | Client isConnected: ${clientState}`);
    if (clientState && hostState > 0) {
      connected = true;
      console.log('\n🎉 SUCCESS! WebRTC DataChannel connection established over Cloudflare Tunnel WAN URL!\n');
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();
  try { cloudflared.kill(); } catch (e) {}
  process.exit(connected ? 0 : 1);
}

runTunnelTest().catch(err => {
  console.error('Tunnel test error:', err);
  try { if (cloudflared) cloudflared.kill(); } catch (e) {}
  process.exit(1);
});
