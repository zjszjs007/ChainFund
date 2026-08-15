# 链筹 ChainFund — 去中心化内容众筹平台

创作者发布项目并设定筹款目标；支持者资金锁定在智能合约中。每笔里程碑拨款必须通过验证（支持者投票 / 第三方仲裁 / 时间锁）才会解锁给创作者，用途证明（工作报告、代码提交记录等）以 IPFS 链接形式上链可查。

## 目录结构

```
chainfund/
├── contracts/MilestoneFund.sol   # Campaign（众筹活动）+ MilestoneFundFactory（工厂）
├── scripts/deploy.js             # 部署工厂 + 播种 3 个演示项目（三种验证模式）
├── test/MilestoneFund.test.js    # 合约测试（投票/仲裁/时间锁/退款/金额校验）
├── hardhat.config.js
└── frontend/                     # Vite + React + ethers v6 前端
    └── src/
        ├── pages/                # Home / ProjectDetail / CreateProject / Dashboard
        ├── wallet.jsx            # 钱包连接（MetaMask + 本地测试账户切换）
        ├── contract.js           # ABI、格式化、IPFS 网关、交易记录
        └── components.jsx        # 项目卡片、进度条、里程碑时间线
```

## 快速启动（推荐）

如果依赖已安装，一条命令即可拉起本地链 + 编译部署 + 前端（自动检测端口、后台托管进程，日志见 `chainfund-node.log` / `chainfund-frontend.log`）：

```bash
node start-dev.cjs
```

执行后浏览器打开 http://localhost:5173 即可。脚本要求 Node.js 18+。

> Windows 用户：可直接双击根目录的 `start.bat`，它会自动切换到脚本所在目录并定位 node 环境，效果同上（关闭窗口不会停止后台服务）。

## 手动运行步骤

```bash
# 1. 安装合约依赖
cd chainfund
npm install

# 2. 启动本地区块链（保持该终端运行）
npm run node

# 3. 新开终端：编译 + 部署（会自动播种演示项目并写入前端配置）
npm run compile
npm run deploy

# 4. 启动前端
cd frontend
npm install
npm run dev
```

浏览器打开 http://localhost:5173

## 测试

```bash
cd chainfund
npm test
```

## 使用说明

- **测试用户**：右上角「测试用户」按钮直连本地 Hardhat 节点，下拉框可切换 20 个测试账户，模拟创作者 / 支持者 / 仲裁人等不同角色（账户 #0 是部署人兼项目一创作者，#1、#2 是其他项目创作者与支持者，#3 是仲裁人）。
- **三种验证模式**：
  - 支持者投票：按出资额加权，审查窗口结束后结算，赞成 > 反对即放款；
  - 第三方仲裁：仅指定仲裁地址可通过或驳回；
  - 时间锁：公示期内无人争议，到期任何人可触发自动放款。
- **资金透明度**：项目详情页「资金透明度」与里程碑时间线直接读取合约状态；IPFS 证明链接可点击跳转公共网关；本地链无区块浏览器时，页面底部「我的链上操作记录」展示交易哈希。
- **部署到真实测试网**：修改 `hardhat.config.js` 增加网络与私钥，重新执行 `hardhat run scripts/deploy.js --network <网络>`，并在 `frontend/src/contract-config.json` 中填入对应链的 `explorerUrl` 即可启用浏览器跳转。

## 合约要点

- 里程碑金额之和必须等于筹款目标（`milestones sum != goal`）；
- 里程碑状态机：`Locked → UnderReview → Released / Rejected`；
- 未达标项目截止后任何人可 `markFailed()`，支持者 `refund()` 取回出资；
- 所有关键动作均发出事件（Contributed / MilestoneRequested / Voted / MilestoneReleased / Refunded），便于链上审计。

## 端口与常见问题

| 服务 | 地址 | 说明 |
|------|------|------|
| Hardhat 本地链 | `http://127.0.0.1:8545` | 以太坊 JSON-RPC，测试账户 20 个（私钥固定） |
| 前端开发服务器 | `http://localhost:5173` | Vite 仅绑定 IPv6 `localhost`，本机浏览器访问正常 |

- **依赖已安装**：仓库内 `node_modules` 与 `frontend/node_modules` 均已就绪，首次运行可跳过 `npm install`。
- **前端启动报 `.vite` 缓存错误**：若 Vite 提示无法清理 `node_modules/.vite/deps`，把该目录改名（如 `node_modules/.vite.bak`）后重跑 `npm run dev` 即可。
- **重新部署会重置演示数据**：每次 `npm run deploy` / `node start-dev.cjs` 都会重新部署工厂并播种新演示项目，前端配置 `frontend/src/contract-config.json` 同步更新，刷新页面即生效。
- **停止服务**：结束后台 Hardhat 节点与 Vite 进程即可；用 `node start-dev.cjs` 时日志可定位 PID。
- **真实测试网部署**：修改 `hardhat.config.js` 增加网络与私钥，执行 `npx hardhat run scripts/deploy.js --network <网络>`，并在 `frontend/src/contract-config.json` 填入对应链的 `explorerUrl` 启用浏览器跳转。
