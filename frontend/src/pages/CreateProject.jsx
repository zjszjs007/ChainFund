import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { getFactory } from '../contract.js'
import { useWallet } from '../wallet.jsx'

const CATEGORIES = ['技术开发', '影像内容', '文字专栏', '音乐音频', '艺术设计']
const MODES = [
  { id: 0, name: '支持者投票', desc: '按出资额加权投票，赞成权重过半即解锁' },
  { id: 1, name: '第三方仲裁', desc: '指定可信仲裁地址，由其裁决每笔拨款' },
  { id: 2, name: '时间锁释放', desc: '公示审查窗口内无人争议，到期自动解锁' }
]

const emptyMilestone = () => ({ deliverable: '', amount: '', dueAt: '' })

export default function CreateProject() {
  const wallet = useWallet()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [basic, setBasic] = useState({ title: '', category: CATEGORIES[0], description: '' })
  const [funding, setFunding] = useState({ goal: '', days: '30', mode: 0, arbitrator: '', reviewDays: '3' })
  const [milestones, setMilestones] = useState([emptyMilestone()])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const milestoneSum = useMemo(
    () => milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0),
    [milestones]
  )
  const goalNum = parseFloat(funding.goal) || 0
  const sumMatches = goalNum > 0 && Math.abs(milestoneSum - goalNum) < 1e-9

  function setM(i, patch) {
    setMilestones(ms => ms.map((m, idx) => idx === i ? { ...m, ...patch } : m))
  }

  function validateStep() {
    if (step === 0) {
      if (!basic.title.trim()) return '请填写项目标题'
      if (!basic.description.trim()) return '请填写项目介绍'
    }
    if (step === 1) {
      if (!(goalNum > 0)) return '请填写有效的筹款目标（ETH）'
      if (!(Number(funding.days) > 0)) return '请填写有效的筹款天数'
      if (funding.mode === 1 && !ethers.isAddress(funding.arbitrator)) return '请填写有效的仲裁地址'
      if (funding.mode !== 1 && !(Number(funding.reviewDays) > 0)) return '请填写有效的审查天数'
    }
    if (step === 2) {
      for (const [i, m] of milestones.entries()) {
        if (!m.deliverable.trim()) return `里程碑 ${i + 1}：请填写交付物 / 资金用途说明`
        if (!(parseFloat(m.amount) > 0)) return `里程碑 ${i + 1}：请填写有效的拨款金额`
        if (!m.dueAt) return `里程碑 ${i + 1}：请选择预计完成时间`
      }
      if (!sumMatches) return `里程碑金额之和（${milestoneSum} ETH）必须等于筹款目标（${goalNum} ETH）`
    }
    return ''
  }

  function next() {
    const err = validateStep()
    if (err) { setError(err); return }
    setError(''); setStep(s => s + 1)
  }

  async function submit() {
    if (!wallet.signer) { setError('请先连接钱包或选择测试用户'); return }
    const err = validateStep()
    if (err) { setError(err); return }
    setPending(true); setError('')
    try {
      const factory = getFactory(wallet.signer)
      const now = Math.floor(Date.now() / 1000)
      const deadline = now + Number(funding.days) * 86400
      const reviewPeriod = funding.mode === 1 ? 0 : Number(funding.reviewDays) * 86400
      const tx = await factory.createCampaign(
        basic.title, basic.description, basic.category, '',
        ethers.parseEther(funding.goal), deadline, funding.mode,
        funding.mode === 1 ? funding.arbitrator : ethers.ZeroAddress,
        reviewPeriod,
        milestones.map(m => ethers.parseEther(m.amount)),
        milestones.map(m => m.deliverable),
        milestones.map(m => BigInt(Math.floor(new Date(m.dueAt).getTime() / 1000)))
      )
      await tx.wait()
      navigate('/dashboard')
    } catch (e) {
      setError(e?.reason || e?.shortMessage || e.message)
    } finally {
      setPending(false)
    }
  }

  const steps = ['基本信息', '筹款目标', '里程碑计划', '确认上链']

  return (
    <div className="form-page">
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 24 }}>发起众筹</h1>

      <div className="steps">
        {steps.map((s, i) => (
          <div key={s} data-n={i + 1} className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>{s}</div>
        ))}
      </div>

      <div className="panel">
        {error && <div className="notice notice-err">{error}</div>}

        {step === 0 && (
          <>
            <div className="field">
              <label>项目标题</label>
              <input value={basic.title} onChange={e => setBasic({ ...basic, title: e.target.value })} placeholder="例如：开源去中心化存储网络" />
            </div>
            <div className="field">
              <label>项目分类</label>
              <select value={basic.category} onChange={e => setBasic({ ...basic, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>项目介绍</label>
              <textarea value={basic.description} onChange={e => setBasic({ ...basic, description: e.target.value })}
                placeholder="向支持者说明你要做什么、为什么值得支持。详情将在链上保存。" />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="form-row">
              <div className="field">
                <label>筹款目标（ETH）</label>
                <input type="number" min="0" step="0.1" value={funding.goal} onChange={e => setFunding({ ...funding, goal: e.target.value })} placeholder="10" />
              </div>
              <div className="field">
                <label>筹款天数</label>
                <input type="number" min="1" value={funding.days} onChange={e => setFunding({ ...funding, days: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>里程碑验证方式</label>
              <div className="mode-cards">
                {MODES.map(m => (
                  <div key={m.id} className={`mode-card ${funding.mode === m.id ? 'selected' : ''}`}
                    onClick={() => setFunding({ ...funding, mode: m.id })}>
                    <b>{m.name}</b><span>{m.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            {funding.mode === 1 && (
              <div className="field">
                <label>仲裁地址</label>
                <input className="mono" value={funding.arbitrator} onChange={e => setFunding({ ...funding, arbitrator: e.target.value })} placeholder="0x…" />
                <div className="hint">该地址将对每笔里程碑拨款进行裁决</div>
              </div>
            )}
            {funding.mode !== 1 && (
              <div className="field">
                <label>{funding.mode === 0 ? '投票审查天数' : '时间锁公示天数'}</label>
                <input type="number" min="1" value={funding.reviewDays} onChange={e => setFunding({ ...funding, reviewDays: e.target.value })} />
                <div className="hint">{funding.mode === 0 ? '申请拨款后，支持者在该窗口内投票' : '申请拨款后进入公示期，到期自动解锁'}</div>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            {milestones.map((m, i) => (
              <div className="milestone-form" key={i}>
                {milestones.length > 1 && (
                  <button className="remove" onClick={() => setMilestones(ms => ms.filter((_, idx) => idx !== i))}>✕</button>
                )}
                <b style={{ fontSize: 14 }}>里程碑 {i + 1}</b>
                <div className="field" style={{ marginTop: 10 }}>
                  <label>交付物 / 资金用途说明</label>
                  <input value={m.deliverable} onChange={e => setM(i, { deliverable: e.target.value })} placeholder="例如：完成原型设计 / 发布 Beta 版" />
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>申请金额（ETH）</label>
                    <input type="number" min="0" step="0.1" value={m.amount} onChange={e => setM(i, { amount: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>预计完成时间</label>
                    <input type="date" value={m.dueAt} onChange={e => setM(i, { dueAt: e.target.value })} />
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={() => setMilestones(ms => [...ms, emptyMilestone()])}>+ 添加里程碑</button>
            <div style={{ marginTop: 14 }} className={`sum-line ${sumMatches ? '' : 'err'}`}>
              里程碑合计 {milestoneSum} ETH / 目标 {goalNum || '-'} ETH
              {sumMatches ? ' · 金额匹配，可以上链' : ' · 合计必须等于筹款目标'}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>确认信息（提交后写入智能合约，不可修改）</h3>
            <p style={{ fontSize: 14, color: 'var(--text-2)' }}>
              <b>{basic.title}</b> · {basic.category} · 目标 {funding.goal} ETH · {funding.days} 天 · {MODES[funding.mode].name}
            </p>
            <div style={{ marginTop: 14 }}>
              {milestones.map((m, i) => (
                <div className="milestone-proof" key={i} style={{ marginBottom: 8 }}>
                  里程碑 {i + 1}：拨款 {m.amount} ETH，用于「{m.deliverable}」，截止 {m.dueAt}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="form-actions">
          <button className="btn btn-ghost" disabled={step === 0 || pending} onClick={() => setStep(s => s - 1)}>上一步</button>
          {step < 3
            ? <button className="btn btn-primary" onClick={next}>下一步</button>
            : <button className="btn btn-primary" disabled={pending || !wallet.signer} onClick={submit}>
                {pending ? '交易确认中…' : wallet.signer ? '确认创建并上链' : '请先连接钱包'}
              </button>}
        </div>
      </div>
    </div>
  )
}
