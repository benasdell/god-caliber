import puppeteer from 'puppeteer';
import { spawn } from 'child_process';

console.log('🚀 Starting Automated Dual-Browser WebRTC Multiplayer Test...');

const VITE_PORT = 5173;

async function checkPortOpen(port) {
  try {
    const res = await fetch(`http://localhost:${port}`);
    return res.ok || res.status === 200;
  } catch (e) {
    return false;
  }
}

let viteServer = null;
async function startViteIfNeeded() {
  const isOpen = await checkPortOpen(VITE_PORT);
  if (!isOpen) {
    console.log('📦 Starting local Vite server on http://localhost:5173...');
    viteServer = spawn('npx', ['vite', '--port', '5173'], { shell: true, stdio: 'pipe' });
    await new Promise(r => setTimeout(r, 3000));
  } else {
    console.log('✅ Vite server already running on http://localhost:5173');
  }
}

async function runTest() {
  await startViteIfNeeded();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--allow-insecure-localhost',
      '--disable-web-security'
    ]
  });

  // --- PAGE 1: HOST ---
  console.log('\n🌐 Opening Browser Page 1 (HOST)...');
  const pageHost = await browser.newPage();
  
  pageHost.on('console', msg => {
    console.log(`[HOST ${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  pageHost.on('pageerror', err => console.error('[HOST PAGE ERROR]', err));

  await pageHost.goto(`http://localhost:${VITE_PORT}`, { waitUntil: 'domcontentloaded' });
  await pageHost.waitForSelector('.tab-btn[data-tab="tab-multiplayer"]', { timeout: 10000 });

  // Switch to Multiplayer tab
  console.log('👉 Host selecting Multiplayer tab...');
  await pageHost.click('.tab-btn[data-tab="tab-multiplayer"]');
  await pageHost.waitForSelector('#host-lobby-btn', { visible: true, timeout: 5000 });

  // Click HOST LOBBY
  console.log('👉 Host clicking #host-lobby-btn...');
  await pageHost.click('#host-lobby-btn');

  // Wait for Room Code to be generated
  await pageHost.waitForFunction(() => {
    return window.gameInstance && window.gameInstance.network && window.gameInstance.network.roomId;
  }, { timeout: 15000 });

  const roomId = await pageHost.evaluate(() => window.gameInstance.network.roomId);
  console.log(`\n👑 LOBBY CREATED ON HOST! Room Code: ${roomId}\n`);

  // --- PAGE 2: CLIENT ---
  console.log('🌐 Opening Browser Page 2 (CLIENT)...');
  const pageClient = await browser.newPage();

  pageClient.on('console', msg => {
    console.log(`[CLIENT ${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  pageClient.on('pageerror', err => console.error('[CLIENT PAGE ERROR]', err));

  await pageClient.goto(`http://localhost:${VITE_PORT}`, { waitUntil: 'domcontentloaded' });
  await pageClient.waitForSelector('.tab-btn[data-tab="tab-multiplayer"]', { timeout: 10000 });

  // Switch to Multiplayer tab
  console.log('👉 Client selecting Multiplayer tab...');
  await pageClient.click('.tab-btn[data-tab="tab-multiplayer"]');
  await pageClient.waitForSelector('#room-code-input', { visible: true, timeout: 5000 });

  // Enter Room Code & Click JOIN
  console.log(`👉 Client entering Room Code "${roomId}" and clicking #join-lobby-btn...`);
  await pageClient.type('#room-code-input', roomId);
  await pageClient.click('#join-lobby-btn');

  // --- MONITOR CONNECTION ---
  console.log('\n⏳ Monitoring WebRTC connection progress for up to 15 seconds...\n');
  let connected = false;
  const startTime = Date.now();

  while (Date.now() - startTime < 15000) {
    const hostState = await pageHost.evaluate(() => {
      const net = window.gameInstance?.network;
      return {
        isConnected: net?.isConnected,
        peerCount: net?.connections?.size || 0,
        peerPlayers: net?.peerPlayers?.size || 0,
        signalingState: net?.diagnostics?.signalingState
      };
    });

    const clientState = await pageClient.evaluate(() => {
      const net = window.gameInstance?.network;
      return {
        isConnected: net?.isConnected,
        peerCount: net?.connections?.size || 0,
        peerPlayers: net?.peerPlayers?.size || 0,
        signalingState: net?.diagnostics?.signalingState,
        connectionState: net?.connectionState
      };
    });

    console.log(`📊 t+${Math.round((Date.now() - startTime)/1000)}s | Host peers: ${hostState.peerCount} | Client status: ${clientState.connectionState} (isConnected=${clientState.isConnected})`);

    if (clientState.isConnected && hostState.peerCount > 0) {
      connected = true;
      console.log('\n🎉 SUCCESS! WebRTC DataChannel connection established between Host and Client!\n');
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!connected) {
    console.error('\n❌ FAIL: Connection failed or timed out.\n');
  }

  await browser.close();
  if (viteServer) viteServer.kill();
  process.exit(connected ? 0 : 1);
}

runTest().catch(err => {
  console.error('Test script error:', err);
  if (viteServer) viteServer.kill();
  process.exit(1);
});
