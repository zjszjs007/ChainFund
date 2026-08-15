import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ethers } from 'ethers'
import {
  CONFIG, coverStyle, daysLeft, fmtEth, getCampaign, getReadProvider,
  getRecordedTxs, recordTx, shortAddr
} from '../contract.js'
import { useWallet } from '../wallet.jsx'
import { MilestoneItem, ModeTag, ProgressBar, TxList } from '../components.jsx'

export default function ProjectDetail() {
  const { address } = useParams()
  const wallet = useWallet()
  const [data, setData] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [myContribution, setMyContribution] = useState(0n)
  const [myVotes, setMyVotes] = useState({})
  const [tab, setTab] = useState('detail') // detail | transparency
  const [amount, setAmount] = useState('')
  const [proofInputs, setProofInputs] = useState({})
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const [txs, setTxs] = useState([])

  const load = useCallback(async () => {
    const provider = getReadProvider()
    const c = getCampaign(address, provider)
    const [creator, title, category, , goal, raised, deadline, supporters, mode, failed] = await c.getSummary()
    const description = await c.description()
    const arbitrator = await c.arbitrator()
    const n = Number(await c.milestoneCount())
    const ms = []
    for (let i = 0; i < n; i++) ms.push(await c.getMilestone(i))
    setData({ address, creator, title, category, goal, raised, deadline, supporters, mode, failed, description, arbitrator })
    setMilestones(ms)
    setTxs(getRecordedTxs(address))

    if (wallet.address) {
      setMyContribution(await c.contributions(wallet.address))
      const votes = {}
      for (let i = 0; i < n; i++) votes[i] = await c.hasVoted(i, wallet.address)
      setMyVotes(votes)
    } else {
      setMyContribution(0n)
      setMyVotes({})
    }
  }, [address, wallet.address])

  useEffect(() => { load().catch(console.error) }, [load])

  if (!data) return <div className="container"><div className="empty-box" style={{ marginTop: 40 }}>正在从链上加载项目…</div></div>

  const isCreator = wallet.address && wallet.address.toLowerCase() === data.creator.toLowerCase()
  const isArbitrator = wallet.address && wallet.address.toLowerCase() === data.arbitrator.toLowerCase()
  const isSupporter = myContribution > 0n
  const explorer = CONFIG.explorerUrl

  async function send(label, fn) {
    if (!wallet.signer) { alert('请先连接钱包或选择测试用户'); return }
    setError(''); setPending(label)
    try {
      const tx = await fn(getCampaign(address, wallet.signer))
      const receipt = await tx.wait()
      recordTx(address, label, receipt.hash)
      await wallet.refresh()
      await load()
    } catch (e) {
      setError(e?.reason || e?.shortMessage || e.message)
    } finally {
      setPending('')
    }
  }

  const contribute = () => {
    if (!amount || Number(amount) <= 0) { setError('请输入有效的支持金额'); return }
    send(`支持项目 ${amount} ETH`, c => c.contribute({ value: ethers.parseEther(amount) }))
  }

  const cover = coverStyle(data.category)

  return (
    <div className="container detail-layout">
      {/* 左栏：项目信息与里程碑 */}
      <div>
        <div className="panel">
          <div className="detail-cover" style={{ background: cover.bg }}><span>{cover.icon}</span></div>
          <div className="project-tags">
            <span className="tag tag-category">{data.category}</span>
            <ModeTag mode={data.mode} />
            {data.failed && <span className="badge badge-rejected">未达标 · 开放退款</span>}
          </div>
          <h1 className="detail-title">{data.title}</h1>
          <div className="creator-line">
            <span>发起人：</span>
            {explorer
              ? <a className="mono" href={`${explorer}/address/${data.creator}`} target="_blank" rel="noreferrer">{data.creator}</a>
              : <span className="mono">{data.creator}</span>}
            <span>·</span>
            <span>合约：<span className="mono">{shortAddr(address)}</span></span>
          </div>

          <div className="tabs">
            <button className={tab === 'detail' ? 'active' : ''} onClick={() => setTab('detail')}>项目详情</button>
            <button className={tab === 'transparency' ? 'active' : ''} onClick={() => setTab('transparency')}>资金透明度</button>
          </div>

          {tab === 'detail' && (
            <p style={{ fontSize: 15, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{data.description}</p>
          )}

          {tab === 'transparency' && (
            <div>
              <div className="notice notice-info">
                本页面板直接读取合约状态：每个里程碑的拨款金额、用途说明、验证结果与 IPFS 证明链接均来自链上数据。
              </div>
              <ProgressBar raised={data.raised} goal={data.goal} />
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-3)' }}>
                合约地址 <span className="mono">{address}</span>
                {explorer && <> · <a href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>在区块浏览器中验证</a></>}
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <h3 style={{ fontSize: 16, marginBottom: 18 }}>里程碑拨款计划</h3>
          {milestones.map((m, i) => (
            <MilestoneItem
              key={i}
              index={i}
              m={m}
              mode={data.mode}
              pending={pending !== ''}
              actions={renderMilestoneActions(i, m)}
            />
          ))}
        </div>

        <TxList txs={txs} />
      </div>

      {/* 右栏：筹款面板 */}
      <div className="panel fund-panel">
        <div className="fund-big">
          <span className="raised">{fmtEth(data.raised)}</span>
          <span className="goal">/ {fmtEth(data.goal)} ETH</span>
        </div>
        <ProgressBar raised={data.raised} goal={data.goal} />
        <div className="fund-stats">
          <div className="fund-stat"><div className="k">支持者</div><div className="v">{data.supporters.toString()} 人</div></div>
          <div className="fund-stat"><div className="k">剩余时间</div><div className="v">{daysLeft(data.deadline)}</div></div>
          <div className="fund-stat"><div className="k">验证方式</div><div className="v" style={{ fontSize: 14 }}>{['支持者投票', '第三方仲裁', '时间锁'][data.mode]}</div></div>
          <div className="fund-stat"><div className="k">我的出资</div><div className="v">{fmtEth(myContribution)} ETH</div></div>
        </div>

        {error && <div className="notice notice-err">{error}</div>}
        {pending && <div className="notice notice-info">交易发送中：{pending}…</div>}

        {!data.failed ? (
          <div className="contribute-row">
            <input type="number" min="0" step="0.01" placeholder="输入 ETH 金额" value={amount} onChange={e => setAmount(e.target.value)} />
            <button className="btn btn-primary" disabled={pending !== ''} onClick={contribute}>支持</button>
          </div>
        ) : (
          isSupporter && (
            <button className="btn btn-danger-soft" style={{ width: '100%' }} onClick={() => send('申请退款', c => c.refund())}>
              取回我的出资（{fmtEth(myContribution)} ETH）
            </button>
          )
        )}

        {isCreator && (
          <div style={{ marginTop: 14 }}>
            <div className="notice notice-warn" style={{ marginBottom: 8 }}>你是本项目发起人，可在左侧里程碑提交拨款申请。</div>
            {!data.failed && (
              <button className="btn btn-ghost btn-sm" onClick={() => send('标记项目未达标', c => c.markFailed())}>
                若已截止且未达标，标记失败
              </button>
            )}
          </div>
        )}
        {isArbitrator && <div className="notice notice-warn" style={{ marginTop: 14 }}>你是本项目仲裁人，可对审查中的里程碑进行裁决。</div>}
      </div>
    </div>
  )

  function renderMilestoneActions(i, m) {
    const btns = []
    // 创作者：申请拨款（提交 IPFS 证明）
    if (isCreator && m.status === 0 && !data.failed) {
      btns.push(
        <input key="proof" style={{ flex: 1, minWidth: 220, border: '1px solid var(--border)', borderRadius: 999, padding: '6px 14px', fontSize: 13 }}
          placeholder="IPFS 证明链接，如 ipfs://bafy…（工作报告 / 代码提交记录）"
          value={proofInputs[i] || ''} onChange={e => setProofInputs({ ...proofInputs, [i]: e.target.value })} />,
        <button key="req" className="btn btn-soft btn-sm" disabled={!proofInputs[i] || pending !== ''}
          onClick={() => send(`申请里程碑 ${i + 1} 拨款`, c => c.requestMilestoneRelease(i, proofInputs[i]))}>
          申请拨款
        </button>
      )
    }
    // 投票模式：支持者投票
    if (data.mode === 0 && m.status === 1) {
      if (isSupporter && !myVotes[i]) {
        btns.push(
          <button key="yes" className="btn btn-soft btn-sm" disabled={pending !== ''} onClick={() => send(`投票赞成里程碑 ${i + 1}`, c => c.vote(i, true))}>投赞成票</button>,
          <button key="no" className="btn btn-danger-soft btn-sm" disabled={pending !== ''} onClick={() => send(`投票反对里程碑 ${i + 1}`, c => c.vote(i, false))}>投反对票</button>
        )
      } else if (myVotes[i]) {
        btns.push(<span key="done" className="tx-line">你已投票</span>)
      }
      if (Date.now() / 1000 > Number(m.reviewEndsAt)) {
        btns.push(<button key="fin" className="btn btn-primary btn-sm" disabled={pending !== ''} onClick={() => send(`结算里程碑 ${i + 1} 投票`, c => c.finalizeVote(i))}>结算投票</button>)
      }
    }
    // 仲裁模式
    if (data.mode === 1 && m.status === 1 && isArbitrator) {
      btns.push(
        <button key="ok" className="btn btn-soft btn-sm" disabled={pending !== ''} onClick={() => send(`仲裁通过里程碑 ${i + 1}`, c => c.arbitratorResolve(i, true))}>仲裁通过</button>,
        <button key="rej" className="btn btn-danger-soft btn-sm" disabled={pending !== ''} onClick={() => send(`仲裁驳回里程碑 ${i + 1}`, c => c.arbitratorResolve(i, false))}>仲裁驳回</button>
      )
    }
    // 时间锁模式
    if (data.mode === 2 && m.status === 1 && Date.now() / 1000 > Number(m.reviewEndsAt)) {
      btns.push(<button key="claim" className="btn btn-primary btn-sm" disabled={pending !== ''} onClick={() => send(`时间锁释放里程碑 ${i + 1}`, c => c.claimTimelockRelease(i))}>时间锁到期 · 释放拨款</button>)
    }
    return btns.length ? btns : null
  }
}
