import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { CONFIG, getReadProvider } from './contract.js'

const WalletContext = createContext(null)

/**
 * 钱包连接：
 *  - MetaMask 模式：连接浏览器扩展钱包
 *  - 测试模式：直连本地 Hardhat 节点，列出全部测试账户，可切换模拟不同用户
 */
export function WalletProvider({ children }) {
  const [mode, setMode] = useState('none') // none | metamask | local
  const [signer, setSigner] = useState(null)
  const [address, setAddress] = useState('')
  const [balance, setBalance] = useState(null)
  const [testAccounts, setTestAccounts] = useState([]) // [{address, index}]
  const [pickerOpen, setPickerOpen] = useState(false)

  const refreshBalance = useCallback(async (addr, provider) => {
    try {
      const b = await provider.getBalance(addr)
      setBalance(b)
    } catch { setBalance(null) }
  }, [])

  const applySigner = useCallback(async (s, m) => {
    const addr = await s.getAddress()
    setSigner(s)
    setAddress(addr)
    setMode(m)
    await refreshBalance(addr, s.provider)
  }, [refreshBalance])

  /** 连接 MetaMask */
  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum) {
      alert('未检测到 MetaMask，请安装扩展，或使用右侧「测试用户」模式')
      return
    }
    const provider = new ethers.BrowserProvider(window.ethereum)
    await provider.send('eth_requestAccounts', [])
    const s = await provider.getSigner()
    await applySigner(s, 'metamask')
  }, [applySigner])

  /** 拉取本地 Hardhat 测试账户列表 */
  const loadTestAccounts = useCallback(async () => {
    try {
      const provider = getReadProvider()
      const accounts = await provider.listAccounts()
      setTestAccounts(accounts.map((a, i) => ({ address: a.address, index: i })))
      return accounts
    } catch (e) {
      alert('无法连接本地链，请先运行 npx hardhat node')
      return []
    }
  }, [])

  /** 切换到某个测试账户 */
  const useTestAccount = useCallback(async (index) => {
    const provider = getReadProvider()
    const s = await provider.getSigner(index)
    await applySigner(s, 'local')
  }, [applySigner])

  const disconnect = useCallback(() => {
    setMode('none'); setSigner(null); setAddress(''); setBalance(null)
  }, [])

  // MetaMask 账户切换监听
  useEffect(() => {
    if (!window.ethereum || mode !== 'metamask') return
    const onAccounts = async () => { if (mode === 'metamask') await connectMetaMask() }
    window.ethereum.on('accountsChanged', onAccounts)
    return () => window.ethereum.removeListener('accountsChanged', onAccounts)
  }, [mode, connectMetaMask])

  const value = {
    mode, signer, address, balance, testAccounts, pickerOpen, setPickerOpen,
    connectMetaMask, loadTestAccounts, useTestAccount, disconnect,
    refresh: () => address && refreshBalance(address, signer?.provider ?? getReadProvider())
  }
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  return useContext(WalletContext)
}

/** 导航栏右侧的钱包组件：未连接 / 已连接（地址+余额） / 测试用户切换 */
export function WalletButton() {
  const w = useWallet()

  if (w.mode === 'none') {
    return (
      <div className="wallet-area">
        <button className="btn btn-primary btn-sm" onClick={w.connectMetaMask}>连接钱包</button>
        <button className="btn btn-ghost btn-sm" onClick={async () => {
          const accs = await w.loadTestAccounts()
          if (accs.length) { w.setPickerOpen(true); await w.useTestAccount(0) }
        }}>测试用户</button>
      </div>
    )
  }

  return (
    <div className="wallet-area">
      {w.mode === 'local' && w.testAccounts.length > 0 && (
        <select
          className="account-select mono"
          value={w.testAccounts.findIndex(a => a.address.toLowerCase() === w.address.toLowerCase())}
          onChange={e => w.useTestAccount(Number(e.target.value))}
          title="切换测试用户，模拟不同角色"
        >
          {w.testAccounts.map(a => (
            <option key={a.index} value={a.index}>测试账户 #{a.index} · {a.address.slice(0, 8)}…</option>
          ))}
        </select>
      )}
      <span className="wallet-chip">
        <span className="dot" />
        <span className="mono">{w.address.slice(0, 6)}...{w.address.slice(-4)}</span>
        {w.balance !== null && (
          <span className="wallet-balance">{parseFloat(ethers.formatEther(w.balance)).toFixed(2)} ETH</span>
        )}
      </span>
      <button className="btn btn-ghost btn-sm" onClick={w.disconnect}>断开</button>
    </div>
  )
}
