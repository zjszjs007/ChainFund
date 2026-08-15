const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const eth = (v) => ethers.parseEther(v);
const DAY = 24 * 3600;

async function deployFactory() {
  const Factory = await ethers.getContractFactory("MilestoneFundFactory");
  return Factory.deploy();
}

describe("MilestoneFund 里程碑众筹", function () {
  it("投票模式：出资 → 申请拨款 → 投票 → 结算后资金释放给创作者", async function () {
    const [creator, alice, bob] = await ethers.getSigners();
    const factory = await deployFactory();
    const now = await time.latest();

    await factory.connect(creator).createCampaign(
      "T", "D", "C", "", eth("4"), now + 10 * DAY, 0,
      ethers.ZeroAddress, DAY,
      [eth("1"), eth("3")], ["m1", "m2"], [now + 5 * DAY, now + 9 * DAY]
    );
    const addr = (await factory.getCampaigns())[0];
    const c = await ethers.getContractAt("Campaign", addr);

    await c.connect(alice).contribute({ value: eth("2") });
    await c.connect(bob).contribute({ value: eth("1") });
    expect(await c.raised()).to.equal(eth("3"));
    expect(await c.supporterCount()).to.equal(2);

    await c.connect(creator).requestMilestoneRelease(0, "ipfs://proof");
    await c.connect(alice).vote(0, true);
    await c.connect(bob).vote(0, false);

    await time.increase(DAY + 1);

    const before = await ethers.provider.getBalance(creator.address);
    await c.finalizeVote(0);
    const after = await ethers.provider.getBalance(creator.address);
    expect(after - before).to.be.gt(eth("0.99")); // 收到约 1 ETH（扣除 gas 后略少）

    const m = await c.getMilestone(0);
    expect(m.status).to.equal(2); // Released
    expect(m.proofURI).to.equal("ipfs://proof");
  });

  it("投票模式：反对票占优则驳回", async function () {
    const [creator, alice] = await ethers.getSigners();
    const factory = await deployFactory();
    const now = await time.latest();
    await factory.connect(creator).createCampaign(
      "T", "D", "C", "", eth("1"), now + 10 * DAY, 0,
      ethers.ZeroAddress, DAY, [eth("1")], ["m1"], [now + 5 * DAY]
    );
    const c = await ethers.getContractAt("Campaign", (await factory.getCampaigns())[0]);
    await c.connect(alice).contribute({ value: eth("1") });
    await c.connect(creator).requestMilestoneRelease(0, "ipfs://x");
    await c.connect(alice).vote(0, false);
    await time.increase(DAY + 1);
    await c.finalizeVote(0);
    expect((await c.getMilestone(0)).status).to.equal(3); // Rejected
  });

  it("仲裁模式：仅仲裁人可通过", async function () {
    const [creator, alice, arb] = await ethers.getSigners();
    const factory = await deployFactory();
    const now = await time.latest();
    await factory.connect(creator).createCampaign(
      "T", "D", "C", "", eth("1"), now + 10 * DAY, 1,
      arb.address, 0, [eth("1")], ["m1"], [now + 5 * DAY]
    );
    const c = await ethers.getContractAt("Campaign", (await factory.getCampaigns())[0]);
    await c.connect(alice).contribute({ value: eth("1") });
    await c.connect(creator).requestMilestoneRelease(0, "ipfs://x");
    await expect(c.connect(alice).arbitratorResolve(0, true)).to.be.revertedWith("not arbitrator");
    await c.connect(arb).arbitratorResolve(0, true);
    expect((await c.getMilestone(0)).status).to.equal(2);
  });

  it("时间锁模式：窗口内不可提取，到期自动释放", async function () {
    const [creator, alice] = await ethers.getSigners();
    const factory = await deployFactory();
    const now = await time.latest();
    await factory.connect(creator).createCampaign(
      "T", "D", "C", "", eth("1"), now + 10 * DAY, 2,
      ethers.ZeroAddress, DAY, [eth("1")], ["m1"], [now + 5 * DAY]
    );
    const c = await ethers.getContractAt("Campaign", (await factory.getCampaigns())[0]);
    await c.connect(alice).contribute({ value: eth("1") });
    await c.connect(creator).requestMilestoneRelease(0, "ipfs://x");
    await expect(c.claimTimelockRelease(0)).to.be.revertedWith("timelock active");
    await time.increase(DAY + 1);
    await c.claimTimelockRelease(0);
    expect((await c.getMilestone(0)).status).to.equal(2);
  });

  it("未达标：截止后可退款", async function () {
    const [creator, alice] = await ethers.getSigners();
    const factory = await deployFactory();
    const now = await time.latest();
    await factory.connect(creator).createCampaign(
      "T", "D", "C", "", eth("10"), now + DAY, 0,
      ethers.ZeroAddress, DAY, [eth("10")], ["m1"], [now + 5 * DAY]
    );
    const c = await ethers.getContractAt("Campaign", (await factory.getCampaigns())[0]);
    await c.connect(alice).contribute({ value: eth("1") });
    await time.increase(2 * DAY);
    await c.markFailed();
    const before = await ethers.provider.getBalance(alice.address);
    await c.connect(alice).refund();
    expect(await ethers.provider.getBalance(alice.address)).to.be.gt(before);
  });

  it("里程碑金额之和必须等于筹款目标", async function () {
    const [creator] = await ethers.getSigners();
    const factory = await deployFactory();
    const now = await time.latest();
    await expect(factory.connect(creator).createCampaign(
      "T", "D", "C", "", eth("5"), now + 10 * DAY, 0,
      ethers.ZeroAddress, DAY, [eth("1")], ["m1"], [now + 5 * DAY]
    )).to.be.revertedWith("milestones sum != goal");
  });
});
