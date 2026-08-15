import { Link } from 'react-router-dom'
import {
  MODE_NAMES, MILESTONE_STATUS, coverStyle, daysLeft,
  fmtDate, fmtEth, ipfsToHttp, shortAddr
} from './contract.js'

export function ProgressBar({ raised, goal }) {
  const pct = goal > 0n ? Math.min(100, Number((raised * 10000n) / goal) / 100) : 0
  return (
    <div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="project-nums" style={{ marginTop: 6 }}>
        <span><b>{fmtEth(raised)}</b> / {fmtEth(goal)} ETH</span>
        <span>{pct}%</span>
      </div>
    </div>
  )
}

export function ModeTag({ mode }) {
  return <span className="tag tag-mode">{MODE_NAMES[mode]}</span>
}

export function StatusBadge({ status }) {
  const cls = ['badge-locked', 'badge-review', 'badge-released', 'badge-rejected'][status]
  return <span className={`badge ${cls}`}>{MILESTONE_STATUS[status]}</span>
}

export function ProjectCard({ p }) {
  const cover = coverStyle(p.category)
  return (
    <Link to={`/project/${p.address}`} className="project-card">
      <div className="project-cover" style={{ background: cover.bg }}>
        <span>{cover.icon}</span>
      </div>
      <div className="project-body">
        <div className="project-tags">
          <span className="tag tag-category">{p.category}</span>
          <ModeTag mode={p.mode} />
        </div>
        <div className="project-title">{p.title}</div>
        <div className="project-desc">{p.description}</div>
        <ProgressBar raised={p.raised} goal={p.goal} />
        <div className="project-meta">
          <span>{p.supporters.toString()} 位支持者</span>
          <span>{p.failed ? '未达标 · 可退款' : daysLeft(p.deadline)}</span>
        </div>
      </div>
    </Link>
  )
}

/** 里程碑时间线条目：「里程碑 X：拨款 Y，用于 Z，验证状态」+ IPFS 证明链接 + 操作 */
export function MilestoneItem({ index, m, mode, role, myVoteDone, actions, pending }) {
  const cls = ['', 'm-review', 'm-released', 'm-rejected'][m.status]
  const totalVotes = m.yesWeight + m.noWeight
  const yesPct = totalVotes > 0n ? Number((m.yesWeight * 100n) / totalVotes) : 0

  return (
    <div className={`milestone ${cls}`}>
      <div className="milestone-dot">{m.status === 2 ? '✓' : index + 1}</div>
      <div className="milestone-card">
        <div className="milestone-head">
          <b>里程碑 {index + 1} · {m.deliverable}</b>
          <span>
            <span className="milestone-amount">{fmtEth(m.amount)} ETH</span>{' '}
            <StatusBadge status={m.status} />
          </span>
        </div>
        <div className="milestone-desc">
          计划完成：{fmtDate(m.dueAt)}
          {m.reviewEndsAt > 0n && m.status === 1 && ` · 验证截止：${fmtDate(m.reviewEndsAt)}`}
        </div>

        {m.proofURI && (
          <div className="milestone-proof">
            <span className="label">资金用途证明（IPFS）：</span>
            <a href={ipfsToHttp(m.proofURI)} target="_blank" rel="noreferrer" className="mono">
              {m.proofURI}
            </a>
          </div>
        )}

        {mode === 0 && m.status === 1 && (
          <>
            <div className="vote-bar"><div className="yes" style={{ width: `${yesPct}%` }} /></div>
            <div className="vote-nums">
              赞成 {fmtEth(m.yesWeight)} ETH · 反对 {fmtEth(m.noWeight)} ETH（按出资额加权）
            </div>
          </>
        )}

        {actions && <div className="milestone-actions">{actions}</div>}
        {pending && <div className="tx-line">交易确认中…</div>}
      </div>
    </div>
  )
}

export function TxList({ txs }) {
  if (!txs.length) return null
  return (
    <div className="panel">
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>我的链上操作记录</h3>
      {txs.map((t, i) => (
        <div className="tx-line" key={i}>
          [{new Date(t.at).toLocaleString('zh-CN')}] {t.label} · Tx: <span className="mono">{t.hash}</span>
        </div>
      ))}
    </div>
  )
}

export { shortAddr }
