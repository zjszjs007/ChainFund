const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [creator, alice, bob, arbitrator] = await ethers.getSigners();

  // 1. 部署工厂
  const Factory = await ethers.getContractFactory("MilestoneFundFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("MilestoneFundFactory 部署于:", factoryAddr);

  const eth = (v) => ethers.parseEther(v);
  const now = (await ethers.provider.getBlock("latest")).timestamp;
  const day = 24 * 3600;

  // 2. 播种三个演示项目（三种验证模式各一个）
  // 项目一：支持者投票模式
  await (await factory.connect(creator).createCampaign(
    "开源去中心化存储网络",
    "一个面向创作者的开源分布式存储协议，文件经加密后切片存储在节点网络中，全程链上可验证。",
    "技术开发",
    "",
    eth("10"),
    now + 20 * day,
    0, // SupporterVote
    ethers.ZeroAddress,
    3 * day,
    [eth("2"), eth("3"), eth("5")],
    ["完成原型设计与节点通信协议", "发布 Beta 测试网并接入 100 个节点", "主网上线与安全审计报告"],
    [now + 7 * day, now + 14 * day, now + 20 * day]
  )).wait();

  // 项目二：第三方仲裁模式
  await (await factory.connect(alice).createCampaign(
    "独立纪录片《链上人生》",
    "记录三位 Web3 创作者一年真实生活的独立纪录片，所有募资与支出凭证将同步到 IPFS 公开可查。",
    "影像内容",
    "",
    eth("5"),
    now + 15 * day,
    1, // Arbitrator
    arbitrator.address,
    0,
    [eth("1.5"), eth("1.5"), eth("2")],
    ["完成前期拍摄与素材整理", "完成粗剪版本并开放点映", "成片交付并上传 IPFS 存档"],
    [now + 5 * day, now + 10 * day, now + 15 * day]
  )).wait();

  // 项目三：时间锁模式
  await (await factory.connect(bob).createCampaign(
    "Web3 科普专栏年度写作计划",
    "每周一篇深度科普长文，拆解区块链底层原理，写作进度与草稿同步至 IPFS，供支持者监督。",
    "文字专栏",
    "",
    eth("2"),
    now + 10 * day,
    2, // Timelock
    ethers.ZeroAddress,
    2 * day,
    [eth("0.5"), eth("0.5"), eth("1")],
    ["发布前 12 期文章", "发布 24 期并开设读者问答", "完成全年 48 期并结集成册"],
    [now + 4 * day, now + 7 * day, now + 10 * day]
  )).wait();

  // 3. 模拟支持者出资
  const campaigns = await factory.getCampaigns();
  const c0 = await ethers.getContractAt("Campaign", campaigns[0]);
  const c1 = await ethers.getContractAt("Campaign", campaigns[1]);
  const c2 = await ethers.getContractAt("Campaign", campaigns[2]);

  await (await c0.connect(alice).contribute({ value: eth("3") })).wait();
  await (await c0.connect(bob).contribute({ value: eth("2.5") })).wait();
  await (await c1.connect(creator).contribute({ value: eth("2") })).wait();
  await (await c1.connect(bob).contribute({ value: eth("1") })).wait();
  await (await c2.connect(creator).contribute({ value: eth("1.2") })).wait();

  // 项目一：创作者申请第一个里程碑拨款（带 IPFS 证明）
  await (await c0.connect(creator).requestMilestoneRelease(0, "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi")).wait();

  console.log("演示项目已创建：");
  console.log("  [投票模式] ", campaigns[0]);
  console.log("  [仲裁模式] ", campaigns[1]);
  console.log("  [时间锁模式]", campaigns[2]);

  // 4. 将部署信息写入前端配置
  const config = {
    factoryAddress: factoryAddr,
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:8545",
    explorerUrl: "" // 本地链无浏览器，置空则前端仅展示交易哈希
  };
  const out = path.join(__dirname, "..", "frontend", "src", "contract-config.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(config, null, 2));
  console.log("前端配置已写入 frontend/src/contract-config.json");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
