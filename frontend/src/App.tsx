import { useEffect, useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import {
  Trees,
  User,
  PlusCircle,
  ShieldCheck,
  ShieldAlert,
  BarChart3,
  ExternalLink,
  Droplets,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { MST_CHAIN_ID, MST_FAUCET, MST_EXPLORER, explorerAddress } from './config/chain'
import { REGISTRY_ADDRESS, isRegistryConfigured } from './lib/registry'
import { useProjects, useRoles } from './hooks/useRegistry'
import { Header } from './components/Header'
import { Gate } from './components/Gate'
import { ProjectsView } from './components/ProjectsView'
import { SubmitProject } from './components/SubmitProject'
import { VerifierPanel } from './components/VerifierPanel'
import { AdminPanel } from './components/AdminPanel'
import { ImpactAnalytics } from './components/ImpactAnalytics'

type Tab = 'registry' | 'mine' | 'submit' | 'verify' | 'admin' | 'analytics'

export default function App() {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain, isPending: switching } = useSwitchChain()
  const roles = useRoles(address)
  const { projects } = useProjects()
  const [tab, setTab] = useState<Tab>('registry')

  const wrongNetwork = isConnected && chainId !== MST_CHAIN_ID
  const locked = wrongNetwork || roles.paused

  // Fall back to registry when a tab stops being available
  useEffect(() => {
    if (!isConnected) setTab('registry')
    if (tab === 'verify' && isConnected && !roles.isVerifier) setTab('registry')
    if (tab === 'admin' && isConnected && !roles.isAdmin) setTab('registry')
  }, [isConnected, roles.isVerifier, roles.isAdmin, tab])

  const tabs: { id: Tab; label: string; icon: React.ReactNode; visible: boolean }[] = [
    { id: 'registry', label: 'Registry', icon: <Trees className="w-4 h-4" />, visible: true },
    { id: 'mine', label: 'My Projects', icon: <User className="w-4 h-4" />, visible: true },
    { id: 'submit', label: 'Submit Project', icon: <PlusCircle className="w-4 h-4" />, visible: true },
    { id: 'analytics', label: 'Impact & Simulator', icon: <BarChart3 className="w-4 h-4" />, visible: true },
    { id: 'verify', label: 'Verifier Desk', icon: <ShieldCheck className="w-4 h-4" />, visible: !isConnected || roles.isVerifier },
    { id: 'admin', label: 'Admin', icon: <ShieldAlert className="w-4 h-4" />, visible: !isConnected || roles.isAdmin },
  ]

  return (
    <div className="app-shell">
      <Header />

      {/* Navigation tabs */}
      <nav className="nav-tabs-bar" aria-label="Main Navigation">
        <div className="nav-tabs-scroll">
          {tabs
            .filter((t) => t.visible)
            .map((t) => (
              <button
                key={t.id}
                className={`nav-tab-btn ${tab === t.id && isConnected ? 'active' : ''}`}
                disabled={!isConnected}
                aria-current={tab === t.id && isConnected ? 'page' : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
        </div>
      </nav>

      {/* Main Container */}
      <main className="main-content">
        {!isConnected && <Gate />}

        {isConnected && !isRegistryConfigured && (
          <div className="banner-alert warn" role="alert">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <strong>Registry Contract Not Configured</strong>
              <p>
                Deploy the contract with <code>npm run deploy:mst</code> in the contracts folder, or set{' '}
                <code>VITE_REGISTRY_ADDRESS</code> in <code>frontend/.env</code>.
              </p>
            </div>
          </div>
        )}

        {wrongNetwork && (
          <div className="banner-alert error" role="alert">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 flex justify-between items-center flex-wrap gap-3">
              <div>
                <strong>Incorrect Blockchain Network</strong>
                <p>Your wallet is currently connected to another network. Switch to MST Testnet (Chain ID 91562037).</p>
              </div>
              <button
                className="btn primary"
                disabled={switching}
                onClick={() => switchChain({ chainId: MST_CHAIN_ID })}
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 inline ${switching ? 'animate-spin' : ''}`} />
                {switching ? 'Switching…' : 'Switch to MST Testnet'}
              </button>
            </div>
          </div>
        )}

        {isConnected && roles.paused && (
          <div className="banner-alert warn" role="status">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <strong>Contract Circuit Breaker Active</strong>
              <p>The CarbonCreditRegistry is temporarily paused by its administrator. Submissions and transfers are halted.</p>
            </div>
          </div>
        )}

        {isConnected && address && isRegistryConfigured && (
          <div className="tab-pane-container">
            {tab === 'registry' && (
              <ProjectsView
                account={address}
                locked={locked}
                onNavigateSubmit={() => setTab('submit')}
              />
            )}
            {tab === 'mine' && (
              <ProjectsView
                account={address}
                locked={locked}
                mineOnly
                onNavigateSubmit={() => setTab('submit')}
              />
            )}
            {tab === 'submit' && <SubmitProject locked={locked} />}
            {tab === 'analytics' && <ImpactAnalytics projects={projects} />}
            {tab === 'verify' && roles.isVerifier && (
              <VerifierPanel account={address} locked={wrongNetwork} />
            )}
            {tab === 'admin' && roles.isAdmin && (
              <AdminPanel
                paused={roles.paused}
                creditsPerTree={roles.creditsPerTree}
                locked={wrongNetwork}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer-bar">
        <div className="footer-left">
          <span className="footer-pill">
            <span className="footer-dot" />
            MST Testnet · Chain {MST_CHAIN_ID}
          </span>
          <span className="footer-sub">ERC-1155 Tokenized Carbon Ledger</span>
        </div>

        <div className="footer-links">
          {isRegistryConfigured && (
            <a
              href={explorerAddress(REGISTRY_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              <span>Contract on MSTScan</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <a
            href={MST_FAUCET}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <Droplets className="w-3.5 h-3.5 text-blue-400" />
            <span>tMSTC Faucet</span>
          </a>
          <a
            href={MST_EXPLORER}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <span>MSTScan Explorer</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </footer>
    </div>
  )
}
