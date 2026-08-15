import { ethers } from 'ethers'
import config from './contract-config.json'

export const CONFIG = config

export const FACTORY_ABI = [
  'function getCampaigns() view returns (address[])',
  'function getCampaignsOf(address creator) view returns (address[])',
  'function createCampaign(string title_, string description_, string category_, string coverURI_, uint256 goal, uint64 deadline, uint8 mode, address arbitrator, uint64 reviewPeriod, uint256[] amounts, string[] deliverables, uint64[] dueAts) returns (address)'
]

export const CAMPAIGN_ABI = [
  'function title() view returns (string)',
  'function description() view returns (string)',
  'function creator() view returns (address)',
  'function arbitrator() view returns (address)',
  'function goal() view returns (uint256)',
  'function raised() view returns (uint256)',
  'function deadline() view returns (uint64)',
  'function supporterCount() view returns (uint256)',
  'function failed() view returns (bool)',
  'function reviewPeriod() view returns (uint64)',
  'function contributions(address) view returns (uint256)',
  'function hasVoted(uint256, address) view returns (bool)',
  'function milestoneCount() view returns (uint256)',
  'function getMilestone(uint256) view returns (tuple(uint256 amount, string deliverable, uint64 dueAt, string proofURI, uint8 status, uint256 yesWeight, uint256 noWeight, uint64 reviewEndsAt))',
  'function getSummary() view returns (address, string, string, string, uint256, uint256, uint64, uint256, uint8, bool)',
  'function contribute() payable',
  'function vote(uint256 index, bool support)',
  'function requestMilestoneRelease(uint256 index, string proofURI)',
  'function finalizeVote(uint256 index)',
  'function arbitratorResolve(uint256 index, bool approve)',
  'function claimTimelockRelease(uint256 index)',
  'function markFailed()',
  'function refund()',
  'event Contributed(address indexed supporter, uint256 amount, uint256 totalRaised)',
  'event MilestoneRequested(uint256 indexed index, string proofURI, uint64 reviewEndsAt)',
  'event Voted(uint256 indexed index, address indexed voter, bool support, uint256 weight)',
  'event MilestoneReleased(uint256 indexed index, uint256 amount, string proofURI)',
  'event Refunded(address indexed supporter, uint256 amount)'
]

export const MODE_NAMES = ['支持者投票', '第三方仲裁', '时间锁']
export const MILESTONE_STATUS = ['待启动', '验证中', '已放款', '已驳回']

/** 只读 Provider（未连接钱包时也能浏览） */
export function getReadProvider() {
  return new ethers.JsonRpcProvider(CONFIG.rpcUrl)
}

export function getFactory(providerOrSigner) {
  if (!CONFIG.factoryAddress) return null
  return new ethers.Contract(CONFIG.factoryAddress, FACTORY_ABI, providerOrSigner)
}

export function getCampaign(address, providerOrSigner) {
  return new ethers.Contract(address, CAMPAIGN_ABI, providerOrSigner)
}

export function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''
}

export function fmtEth(wei, digits = 3) {
  if (wei === undefined || wei === null) return '0'
  const v = parseFloat(ethers.formatEther(wei))
  return v.toLocaleString('zh-CN', { maximumFractionDigits: digits })
}

export function fmtDate(ts) {
  if (!ts) return '-'
  return new Date(Number(ts) * 1000).toLocaleDateString('zh-CN')
}

export function daysLeft(ts) {
  const diff = Number(ts) * 1000 - Date.now()
  if (diff <= 0) return '已结束'
  const d = Math.floor(diff / 86400000)
  return d === 0 ? '不足 1 天' : `剩 ${d} 天`
}

export function ipfsToHttp(uri) {
  if (!uri) return ''
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7)}`
  return uri
}

/** 记录本地交易哈希（本地链无浏览器时的「链上凭证」展示） */
export function recordTx(campaignAddr, label, hash) {
  try {
    const key = `chainfund:txs:${campaignAddr}`
    const list = JSON.parse(localStorage.getItem(key) || '[]')
    list.unshift({ label, hash, at: Date.now() })
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)))
  } catch { /* ignore */ }
}

export function getRecordedTxs(campaignAddr) {
  try {
    return JSON.parse(localStorage.getItem(`chainfund:txs:${campaignAddr}`) || '[]')
  } catch {
    return []
  }
}

/** 封面占位：按分类返回渐变背景与符号（避免外链图片） */
export function coverStyle(category) {
  const palettes = {
    '技术开发': { bg: 'linear-gradient(135deg,#e0f2fe,#d1fae5)', icon: '⛓' },
    '影像内容': { bg: 'linear-gradient(135deg,#ede9fe,#fce7f3)', icon: '🎬' },
    '文字专栏': { bg: 'linear-gradient(135deg,#fef3c7,#ffedd5)', icon: '✍️' },
    '音乐音频': { bg: 'linear-gradient(135deg,#dbeafe,#e0e7ff)', icon: '🎵' },
    '艺术设计': { bg: 'linear-gradient(135deg,#fce7f3,#ede9fe)', icon: '🎨' }
  }
  return palettes[category] || { bg: 'linear-gradient(135deg,#e2e8f0,#f1f5f9)', icon: '📦' }
}
