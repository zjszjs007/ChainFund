import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ethers } from 'ethers'
import { CONFIG, getCampaign, getFactory, getReadProvider } from '../contract.js'
import { ProjectCard } from '../components.jsx'

export default function Home() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalRaised: 0n, count: 0, succeeded: 0, milestonesReleased: 0 })

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const provider = getReadProvider()
        const factory = getFactory(provider)
        if (!factory) { setProjects([]); return }
        const addrs = await factory.getCampaigns()
        const list = await Promise.all(addrs.map(async (address) => {
          const c = getCampaign(address, provider)
          const [creator, title, category, , goal, raised, deadline, supporters, mode, failed] = await c.getSummary()
          const description = await c.description()
          // 统计已放款里程碑数
          const n = Number(await c.milestoneCount())
          let released = 0
          for (let i = 0; i < n; i++) {
            const m = await c.getMilestone(i)
            if (m.status === 2) released++
          }
          return { address, creator, title, category, goal, raised, deadline, supporters, mode, failed, description, released }
        }))
        setProjects(list)
        setStats({
          totalRaised: list.reduce((s, p) => s + p.raised, 0n),
          count: list.length,
          succeeded: list.filter(p => p.raised >= p.goal).length,
          milestonesReleased: list.reduce((s, p) => s + p.released, 0)
        })
      } catch (e) {
        console.error(e)
        setProjects([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="container">
      <section className="hero">
        <span className="hero-kicker">MILESTONE-BASED · ON-CHAIN ESCROW</span>
        <h1>透明众筹，<em>链上守护</em></h1>
        <p>
          创作者按里程碑申请拨款，支持者通过投票、第三方仲裁或时间锁验证每一笔资金去向。
          资金锁定在智能合约中，用途证明存于 IPFS，全程可查、不可篡改。
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#projects">浏览项目</a>
          <Link className="btn btn-ghost" to="/create">发起众筹</Link>
        </div>
      </section>

      <section className="stats-board">
        <div className="stat-card">
          <div className="stat-label">平台总筹款额</div>
          <div className="stat-value">{ethers.formatEther(stats.totalRaised)}<small>ETH</small></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">进行中项目</div>
          <div className="stat-value">{stats.count}<small>个</small></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">已达筹款目标</div>
          <div className="stat-value">{stats.succeeded}<small>个</small></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">已验证放款里程碑</div>
          <div className="stat-value">{stats.milestonesReleased}<small>笔</small></div>
        </div>
      </section>

      <div className="section-head" id="projects">
        <h2>进行中的众筹</h2>
        <span>资金由智能合约托管 · 里程碑验证后解锁</span>
      </div>

      {!CONFIG.factoryAddress && (
        <div className="notice notice-warn">
          尚未检测到合约部署。请先启动本地链并执行部署脚本（npm run node → npm run deploy），然后刷新页面。
        </div>
      )}

      {loading ? (
        <div className="empty-box">正在从链上读取项目…</div>
      ) : projects.length === 0 ? (
        <div className="empty-box">暂无项目，成为第一个发起众筹的创作者吧</div>
      ) : (
        <div className="project-grid">
          {projects.map(p => <ProjectCard key={p.address} p={p} />)}
        </div>
      )}
    </div>
  )
}
