import { NavLink, Route, Routes } from 'react-router-dom'
import { WalletButton } from './wallet.jsx'
import Home from './pages/Home.jsx'
import ProjectDetail from './pages/ProjectDetail.jsx'
import CreateProject from './pages/CreateProject.jsx'
import Dashboard from './pages/Dashboard.jsx'

export default function App() {
  return (
    <>
      <nav className="navbar">
        <div className="container navbar-inner">
          <NavLink to="/" className="logo">
            <span className="logo-badge">链</span>链筹 ChainFund
          </NavLink>
          <div className="nav-links">
            <NavLink to="/" end>浏览项目</NavLink>
            <NavLink to="/create">发起众筹</NavLink>
            <NavLink to="/dashboard">我的项目</NavLink>
          </div>
          <WalletButton />
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/project/:address" element={<ProjectDetail />} />
        <Route path="/create" element={<CreateProject />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>

      <footer className="footer">
        <div className="container footer-inner">
          <span>链筹 ChainFund · 透明众筹，链上守护</span>
          <span>每一笔拨款都经过链上验证 · 里程碑证明存于 IPFS</span>
        </div>
      </footer>
    </>
  )
}
