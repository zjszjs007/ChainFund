const { ethers } = require("hardhat");

// 多角色演示：投票 → 申请拨款 → 仲裁 → 时间锁 → 快进时间 → 结算放款
async function main() {
  const signers = await ethers.getSigners();
  const s = (i) => signers[i];

  const c0 = await ethers.getContractAt("Campaign", "0xa16E02E87b7454126E5E10d957A927A7F5B5d2be");
  const c1 = await ethers.getContractAt("Campaign", "0xB7A5bd0345EF1Cc5E66bf61BdeC17D2461fBd968");
  const c2 = await ethers.getContractAt("Campaign", "0xeEBe00Ac0756308ac4AaBfD76c05c4F3088B8883");
  const log = [];

  // 1. 支持者 #1 #2 对项目一·里程碑1 投赞成票
  await (await c0.connect(s(1)).vote(0, true)).wait(); log.push("#1 赞成 项目一·里程碑1");
  await (await c0.connect(s(2)).vote(0, true)).wait(); log.push("#2 赞成 项目一·里程碑1");

  // 2. 创作者 #0 申请项目一·里程碑2 拨款（附 IPFS 证明）
  await (await c0.connect(s(0)).requestMilestoneRelease(1, "ipfs://bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku")).wait();
  log.push("#0 申请 项目一·里程碑2 拨款（已提交 IPFS 证明）");

  // 3. 项目二：创作者 #1 申请里程碑1，仲裁人 #3 通过
  await (await c1.connect(s(1)).requestMilestoneRelease(0, "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi")).wait();
  log.push("#1 申请 项目二·里程碑1 拨款");
  await (await c1.connect(s(3)).arbitratorResolve(0, true)).wait();
  log.push("#3 仲裁通过 项目二·里程碑1 → 已放款");

  // 4. 项目三：创作者 #2 申请里程碑1（时间锁公示开始）
  await (await c2.connect(s(2)).requestMilestoneRelease(0, "ipfs://bafybeibg2h2x4rdd7i5lmxycdjodnzmgfgkba4lju4bjlhmjebfnkix5f4")).wait();
  log.push("#2 申请 项目三·里程碑1 拨款（时间锁公示中）");

  // 5. 快进 3 天 + 1 秒
  await ethers.provider.send("evm_increaseTime", [3 * 24 * 3600 + 1]);
  await ethers.provider.send("evm_mine", []);
  log.push("--- 链上时间快进 3 天 ---");

  // 6. 结算项目一·里程碑1 投票 → 放款
  await (await c0.finalizeVote(0)).wait(); log.push("结算投票 项目一·里程碑1 → 已放款 2 ETH");

  // 7. 时间锁到期，释放项目三·里程碑1
  await (await c2.claimTimelockRelease(0)).wait(); log.push("时间锁释放 项目三·里程碑1 → 已放款 0.5 ETH");

  const NAMES = ["待启动", "验证中", "已放款", "已驳回"];
  for (const [name, c] of [["项目一(投票)", c0], ["项目二(仲裁)", c1], ["项目三(时间锁)", c2]]) {
    const n = Number(await c.milestoneCount());
    const states = [];
    for (let i = 0; i < n; i++) states.push(NAMES[(await c.getMilestone(i)).status]);
    console.log(name, "→", states.join(" | "));
  }
  console.log("\n执行记录:");
  log.forEach((l) => console.log("  " + l));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
