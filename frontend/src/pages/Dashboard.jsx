import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  daysLeft, fmtEth, getCampaign, getFactory, getReadProvider, shortAddr
} from '../contract.js'
import { useWallet } from '../wallet.jsx'
import { ProgressBar } from '../components.jsx'

export default function Dashboard() {
  const wallet = useWallet()
  const [created, setCreated] = useState([])
  const [supported, setSupported] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!wallet.address) { setCreated([]); setSupported([]); return }
    setLoading(true)
    (async () => {
      try {
        const provider = getReadProvider()
        const factory = getFactory(provider)
        if (!factory) return
        const all = await factory.getCampaigns()

        async function readItem(address) {
          const c = getCampaign(address, provider)
          const [creator, title, , , goal, raised, deadline, supporters, mode, failed] = await c.getSummary()
          const n = Number(await c.milestoneCount())
          const ms = []
          for (let i = 0; i < n; i++) ms.push(await c.getMilestone(i))
          const myContribution = await c.contributions(wallet.address)
          return { address, creator, title, goal, raised, deadline, supporters, mode, failed, ms, myContribution }
        }

        const items = await Promise.all(all.map(readItem))
        setCreated(items.filter(p => p.creator.toLowerCase() === wallet.address.toLowerCase()))
        setSupported(items.filter(p => p.myContribution > 0n))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [wallet.address])

  if (!wallet.address) {
    return (
      <div className="container dash-layout">
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 20 }}>我的项目</h1>
        <div className="empty-box">请先连接钱包，或点击右上角「测试用户」选择一个本地测试账户</div>
      </div>
    )
  }

  return (
    <div className="container dash-layout">
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>我的项目</h1>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>
        当前账户 <span className="mono">{shortAddr(wallet.address)}</span>
      </p>

      <div className="section-head"><h2>我发起的</h2><span>{created.length} 个</span></div>
      {loading ? <div className="empty-box">加载中…</div> : created.length === 0 ? (
        <div className="empty-box">还没有发起项目 · <Link to="/create" style={{ color: 'var(--primary-dark)' }}>立即发起 →</Link></div>
      ) : (
        <div className="dash-grid" style={{ marginBottom: 40 }}>
          {created.map(p => {
            const nextLocked = p.ms.findIndex(m => m.status === 0)
            const underReview = p.ms.findIndex(m => m.status === 1)
            return (
              <div className="dash-item" key={p.address}>
                <div className="row">
                  <h3><Link to={`/project/${p.address}`}>{p.title}</Link></h3>
                  {p.failed
                    ? <span className="badge badge-rejected">未达标</span>
                    : p.raised >= p.goal
                      ? <span className="badge badge-released">已达标</span>
                      : <span className="badge badge-review">筹款中</span>}
                </div>
                <ProgressBar raised={p.raised} goal={p.goal} />
                <div className="row" style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  <span>{p.supporters.toString()} 位支持者 · {daysLeft(p.deadline)}</span>
                  <span>
                    {underReview >= 0 && `里程碑 ${underReview + 1} 验证中`}
                    {underReview < 0 && nextLocked >= 0 && `下一笔：里程碑 ${nextLocked + 1}（${fmtEth(p.ms[nextLocked].amount)} ETH）`}
                    {underReview < 0 && nextLocked < 0 && '全部里程碑已完成'}
                  </span>
                </div>
                <div className="row">
                  <Link className="btn btn-soft btn-sm" to={`/project/${p.address}`}>
                    {nextLocked >= 0 && !p.failed ? '去申请里程碑拨款' : '查看项目'}
                  </Link>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{shortAddr(p.address)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="section-head"><h2>我支持的</h2><span>{supported.length} 个</span></div>
      {loading ? <div className="empty-box">加载中…</div> : supported.length === 0 ? (
        <div className="empty-box">还没有支持任何项目 · <Link to="/" style={{ color: 'var(--primary-dark)' }}>去逛逛 →</Link></div>
      ) : (
        <div className="dash-grid">
          {supported.map(p => {
            const underReview = p.ms.findIndex(m => m.status === 1)
            return (
              <div className="dash-item" key={p.address}>
                <div className="row">
                  <h3><Link to={`/project/${p.address}`}>{p.title}</Link></h3>
                  {p.failed ? <span className="badge badge-rejected">可退款</span>
                    : underReview >= 0 ? <span className="badge badge-review">里程碑 {underReview + 1} 待验证</span>
                    : <span className="badge badge-locked">进行中</span>}
                </div>
                <ProgressBar raised={p.raised} goal={p.goal} />
                <div className="row" style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  <span>我的出资：<b>{fmtEth(p.myContribution)} ETH</b></span>
                  <span>{daysLeft(p.deadline)}</span>
                </div>
                <div className="row">
                  <Link className="btn btn-soft btn-sm" to={`/project/${p.address}`}>
                    {p.failed ? '去退款' : p.mode === 0 && underReview >= 0 ? '去投票验证' : '查看资金去向'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
