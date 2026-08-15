/**
 * ChainFund 一键本地启动脚本（跨平台：Windows / macOS / Linux）
 *
 * 功能：
 *   1. 检测本地链节点(8545) 与前端(5173) 是否已在运行，避免重复拉起
 *   2. 若链未运行 -> 后台启动 Hardhat 节点（日志 chainfund-node.log）
 *   3. 等待链就绪 -> 同步编译 + 部署（播种演示项目，写入前端 contract-config.json）
 *   4. 若前端未运行 -> 后台启动 Vite 开发服务器（日志 chainfund-frontend.log）
 *   5. 打印访问地址
 *
 * 用法：node start-dev.cjs
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const http = require('http');
const path = require('path');

const ROOT = __dirname;
const FRONTEND = path.join(ROOT, 'frontend');
const NODE_LOG = path.join(ROOT, 'chainfund-node.log');
const FE_LOG = path.join(ROOT, 'chainfund-frontend.log');
const RPC = 'http://127.0.0.1:8545';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function portInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const sock = net.connect(port, host);
    sock.setTimeout(1500);
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error', () => { resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

function rpc(method, params = []) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
    const req = http.request(
      RPC,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try { resolve(JSON.parse(body).result); } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function waitChain(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const h = await rpc('eth_blockNumber');
      if (h) { console.log(`  ✅ 本地链已就绪（区块高度 ${parseInt(h, 16)}）`); return true; }
    } catch (_) { /* not ready yet */ }
    await sleep(1500);
  }
  return false;
}

function startDetached(label, cwd, cmdArgs, logPath) {
  const logFd = fs.openSync(logPath, 'a');
  const child = spawn('npm', cmdArgs, {
    cwd,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    shell: true,
    windowsHide: true,
  });
  child.unref();
  console.log(`  🚀 已后台启动 ${label}（PID ${child.pid}，日志 ${logPath}）`);
  return child.pid;
}

(async () => {
  console.log('\n=== ChainFund 一键本地启动 ===\n');

  // 1. 本地链
  const chainUp = await portInUse(8545);
  if (chainUp) {
    console.log('① 本地链节点(8545) 已在运行，跳过启动。');
  } else {
    console.log('① 启动本地链节点(Hardhat)...');
    startDetached('Hardhat 节点', ROOT, ['run', 'node'], NODE_LOG);
    const ok = await waitChain();
    if (!ok) {
      console.error('  ❌ 等待本地链超时，请查看 chainfund-node.log');
      process.exit(1);
    }
  }

  // 2. 编译 + 部署（每次都执行，确保演示数据 & 前端配置最新）
  console.log('\n② 编译合约...');
  execSync('npm run compile', { cwd: ROOT, stdio: 'inherit' });
  console.log('\n③ 部署并播种演示数据（写入 frontend/src/contract-config.json）...');
  execSync('npm run deploy', { cwd: ROOT, stdio: 'inherit' });

  // 3. 前端
  console.log('\n④ 启动前端...');
  const feUp = await portInUse(5173, '::1') || await portInUse(5173, '127.0.0.1');
  if (feUp) {
    console.log('   前端(5173) 已在运行，跳过启动。');
  } else {
    startDetached('Vite 前端', FRONTEND, ['run', 'dev'], FE_LOG);
    await sleep(4000);
  }

  console.log('\n=== 启动完成 ===');
  console.log('   访问地址： http://localhost:5173');
  console.log('   体验：点击右上角「测试用户」切换本地账户（无需 MetaMask）');
  console.log('   停止：结束对应后台进程（node 日志在 chainfund-node.log / chainfund-frontend.log）\n');
})().catch((e) => {
  console.error('启动失败：', e.message || e);
  process.exit(1);
});
