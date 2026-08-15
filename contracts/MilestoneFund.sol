// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Campaign —— 单个众筹项目合约
/// @notice 创作者发起项目并设定里程碑；支持者出资锁定在合约中；
///         每笔里程碑拨款需通过验证（支持者投票 / 第三方仲裁 / 时间锁）才会解锁。
contract Campaign {
    enum Mode { SupporterVote, Arbitrator, Timelock }
    enum MStatus { Locked, UnderReview, Released, Rejected }

    struct Milestone {
        uint256 amount;        // 本阶段拨款金额（wei）
        string  deliverable;   // 交付物描述，如「完成原型设计」
        uint64  dueAt;         // 预计完成时间
        string  proofURI;      // 链下证明链接（IPFS 等），申请拨款时提交
        MStatus status;
        uint256 yesWeight;     // 赞成票权重（按出资额加权）
        uint256 noWeight;      // 反对票权重
        uint64  reviewEndsAt;  // 审查期截止时间（投票 / 时间锁模式使用）
    }

    address public immutable factory;
    address payable public immutable creator;
    address public immutable arbitrator;   // 仅 Arbitrator 模式使用
    Mode    public immutable mode;
    uint64  public immutable deadline;     // 筹款截止时间
    uint64  public immutable reviewPeriod; // 审查窗口（秒）

    string  public title;
    string  public description;
    string  public category;
    string  public coverURI;

    uint256 public goal;
    uint256 public raised;
    uint256 public supporterCount;
    bool    public failed;                 // 到期未达标，开放退款

    Milestone[] private _milestones;
    mapping(address => uint256) public contributions;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event Contributed(address indexed supporter, uint256 amount, uint256 totalRaised);
    event MilestoneRequested(uint256 indexed index, string proofURI, uint64 reviewEndsAt);
    event Voted(uint256 indexed index, address indexed voter, bool support, uint256 weight);
    event MilestoneReleased(uint256 indexed index, uint256 amount, string proofURI);
    event MilestoneRejected(uint256 indexed index);
    event CampaignFailed();
    event Refunded(address indexed supporter, uint256 amount);

    modifier onlyCreator() {
        require(msg.sender == creator, "not creator");
        _;
    }

    constructor(
        address payable _creator,
        string memory _title,
        string memory _description,
        string memory _category,
        string memory _coverURI,
        uint256 _goal,
        uint64 _deadline,
        Mode _mode,
        address _arbitrator,
        uint64 _reviewPeriod,
        uint256[] memory _amounts,
        string[] memory _deliverables,
        uint64[] memory _dueAts
    ) {
        require(_creator != address(0), "creator zero");
        require(_goal > 0, "goal zero");
        require(_deadline > block.timestamp, "deadline past");
        require(_amounts.length > 0, "no milestone");
        require(_amounts.length == _deliverables.length && _amounts.length == _dueAts.length, "length mismatch");
        if (_mode == Mode.Arbitrator) require(_arbitrator != address(0), "arbitrator zero");

        uint256 sum;
        for (uint256 i = 0; i < _amounts.length; i++) {
            sum += _amounts[i];
            _milestones.push(Milestone({
                amount: _amounts[i],
                deliverable: _deliverables[i],
                dueAt: _dueAts[i],
                proofURI: "",
                status: MStatus.Locked,
                yesWeight: 0,
                noWeight: 0,
                reviewEndsAt: 0
            }));
        }
        require(sum == _goal, "milestones sum != goal");

        factory = msg.sender;
        creator = _creator;
        title = _title;
        description = _description;
        category = _category;
        coverURI = _coverURI;
        goal = _goal;
        deadline = _deadline;
        mode = _mode;
        arbitrator = _arbitrator;
        reviewPeriod = _reviewPeriod;
    }

    // ---------------- 支持者 ----------------

    /// @notice 支持项目，资金锁定进合约
    function contribute() external payable {
        require(!failed, "failed");
        require(block.timestamp < deadline, "funding ended");
        require(msg.value > 0, "zero value");
        if (contributions[msg.sender] == 0) supporterCount += 1;
        contributions[msg.sender] += msg.value;
        raised += msg.value;
        emit Contributed(msg.sender, msg.value, raised);
    }

    /// @notice 对审查中的里程碑投票（按出资额加权，一人一票）
    function vote(uint256 index, bool support) external {
        require(mode == Mode.SupporterVote, "not vote mode");
        Milestone storage m = _milestones[index];
        require(m.status == MStatus.UnderReview, "not under review");
        require(block.timestamp <= m.reviewEndsAt, "review ended");
        uint256 weight = contributions[msg.sender];
        require(weight > 0, "not supporter");
        require(!hasVoted[index][msg.sender], "already voted");
        hasVoted[index][msg.sender] = true;
        if (support) m.yesWeight += weight; else m.noWeight += weight;
        emit Voted(index, msg.sender, support, weight);
    }

    // ---------------- 创作者 ----------------

    /// @notice 完成里程碑后申请拨款，并提交链下证明链接（IPFS）
    function requestMilestoneRelease(uint256 index, string calldata proofURI) external onlyCreator {
        require(!failed, "failed");
        Milestone storage m = _milestones[index];
        require(m.status == MStatus.Locked, "not locked");
        m.proofURI = proofURI;
        m.status = MStatus.UnderReview;
        m.reviewEndsAt = mode == Mode.Arbitrator ? 0 : uint64(block.timestamp) + reviewPeriod;
        emit MilestoneRequested(index, proofURI, m.reviewEndsAt);
    }

    // ---------------- 验证与解锁 ----------------

    /// @notice 投票模式：审查期结束后结算，赞成权重 > 反对权重即解锁
    function finalizeVote(uint256 index) external {
        require(mode == Mode.SupporterVote, "not vote mode");
        Milestone storage m = _milestones[index];
        require(m.status == MStatus.UnderReview, "not under review");
        require(block.timestamp > m.reviewEndsAt, "review ongoing");
        if (m.yesWeight > m.noWeight) {
            _release(index);
        } else {
            m.status = MStatus.Rejected;
            emit MilestoneRejected(index);
        }
    }

    /// @notice 仲裁模式：指定第三方裁决
    function arbitratorResolve(uint256 index, bool approve) external {
        require(mode == Mode.Arbitrator, "not arbitrator mode");
        require(msg.sender == arbitrator, "not arbitrator");
        Milestone storage m = _milestones[index];
        require(m.status == MStatus.UnderReview, "not under review");
        if (approve) {
            _release(index);
        } else {
            m.status = MStatus.Rejected;
            emit MilestoneRejected(index);
        }
    }

    /// @notice 时间锁模式：审查窗口内无人争议，到期自动解锁（任何人可触发结算）
    function claimTimelockRelease(uint256 index) external {
        require(mode == Mode.Timelock, "not timelock mode");
        Milestone storage m = _milestones[index];
        require(m.status == MStatus.UnderReview, "not under review");
        require(block.timestamp > m.reviewEndsAt, "timelock active");
        _release(index);
    }

    function _release(uint256 index) internal {
        Milestone storage m = _milestones[index];
        m.status = MStatus.Released;
        (bool ok, ) = creator.call{value: m.amount}("");
        require(ok, "transfer failed");
        emit MilestoneReleased(index, m.amount, m.proofURI);
    }

    // ---------------- 失败与退款 ----------------

    /// @notice 筹款截止且未达标后，任何人可标记失败，开启退款
    function markFailed() external {
        require(!failed, "already");
        require(block.timestamp >= deadline, "not ended");
        require(raised < goal, "goal reached");
        failed = true;
        emit CampaignFailed();
    }

    /// @notice 项目失败后支持者取回出资
    function refund() external {
        require(failed, "not failed");
        uint256 amount = contributions[msg.sender];
        require(amount > 0, "nothing");
        contributions[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        emit Refunded(msg.sender, amount);
    }

    // ---------------- 视图 ----------------

    function milestoneCount() external view returns (uint256) {
        return _milestones.length;
    }

    function getMilestone(uint256 index) external view returns (Milestone memory) {
        return _milestones[index];
    }

    function getSummary() external view returns (
        address _creator, string memory _title, string memory _category, string memory _cover,
        uint256 _goal, uint256 _raised, uint64 _deadline, uint256 _supporters, uint8 _mode, bool _failed
    ) {
        return (creator, title, category, coverURI, goal, raised, deadline, supporterCount, uint8(mode), failed);
    }
}

/// @title MilestoneFundFactory —— 项目工厂
contract MilestoneFundFactory {
    address[] public campaigns;
    mapping(address => address[]) public campaignsOf; // creator => campaigns

    event CampaignCreated(address indexed creator, address campaign, string title);

    function createCampaign(
        string calldata title_,
        string calldata description_,
        string calldata category_,
        string calldata coverURI_,
        uint256 goal,
        uint64 deadline,
        uint8 mode,            // 0=SupporterVote 1=Arbitrator 2=Timelock
        address arbitrator,
        uint64 reviewPeriod,
        uint256[] calldata amounts,
        string[] calldata deliverables,
        uint64[] calldata dueAts
    ) external returns (address) {
        Campaign c = new Campaign(
            payable(msg.sender), title_, description_, category_, coverURI_,
            goal, deadline, Campaign.Mode(mode), arbitrator, reviewPeriod,
            amounts, deliverables, dueAts
        );
        campaigns.push(address(c));
        campaignsOf[msg.sender].push(address(c));
        emit CampaignCreated(msg.sender, address(c), title_);
        return address(c);
    }

    function getCampaigns() external view returns (address[] memory) {
        return campaigns;
    }

    function getCampaignsOf(address creator) external view returns (address[] memory) {
        return campaignsOf[creator];
    }
}
