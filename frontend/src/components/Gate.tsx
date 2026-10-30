import { useState } from 'react'
import { useConnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import {
  TreePine,
  ShieldCheck,
  Cpu,
  Flame,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Lock,
  Layers,
  Droplets,
  ExternalLink,
  Coins,
} from 'lucide-react'
import { MST_CHAIN_ID, MST_EXPLORER, MST_FAUCET } from '../config/chain'

export function Gate() {
  const { connectors, connect } = useConnect()
  const { open } = useAppKit()
  const [calcTrees, setCalcTrees] = useState(250)

  async function handleConnectWallet() {
    // 1. Direct browser extension popup on right side (MetaMask, BridgeKey, etc.)
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        await (window as any).ethereum.request({ method: 'eth_requestAccounts' })
        const injected = connectors.find((c) => c.id === 'injected' || c.type === 'injected')
        if (injected) {
          connect({ connector: injected })
          return
        }
      } catch (err: any) {
        if (err?.code === 4001) return // User cancelled
      }
    }

    // 2. Fallback
    const injected = connectors.find((c) => c.id === 'injected' || c.type === 'injected')
    if (injected) {
      connect({ connector: injected })
    } else if (open) {
      open({ view: 'Connect' })
    }
  }

  // Quick estimation: average 35 kg CO2e per tree per year
  const estimatedCredits = calcTrees * 35
  const estimatedTonnes = (estimatedCredits / 1000).toFixed(2)

  return (
    <div className="gate-container">
      {/* Hero Section */}
      <section className="hero-banner">
        <div className="hero-badge">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>MST Blockchain Hackathon 2026 Edition</span>
        </div>

        <h1 className="hero-title">
          Next-Gen Decentralized <span className="gradient-text">Carbon MRV</span> on MST Blockchain
        </h1>

        <p className="hero-lead">
          High-integrity carbon credit issuance powered by cryptographic Merkle proofs, GPS tree-planting datasets,
          and transparent on-chain auditing.
        </p>

        <div className="hero-cta-group">
          <button className="btn hero-primary-btn" onClick={handleConnectWallet}>
            <span>Launch dApp / Connect Wallet</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          <a
            href={MST_FAUCET}
            target="_blank"
            rel="noopener noreferrer"
            className="btn hero-secondary-btn"
          >
            <Droplets className="w-4 h-4 text-blue-400" />
            <span>Get Free Testnet tMSTC</span>
          </a>
        </div>

        {/* Feature highlight chips */}
        <div className="hero-specs-row">
          <div className="spec-item">
            <span className="spec-dot" />
            <span>MST Testnet Chain ID: <strong>{MST_CHAIN_ID}</strong></span>
          </div>
          <div className="spec-item">
            <span className="spec-dot" />
            <span>Gas Currency: <strong>tMSTC</strong></span>
          </div>
          <div className="spec-item">
            <span className="spec-dot" />
            <span>Token Standard: <strong>ERC-1155</strong></span>
          </div>
          <div className="spec-item">
            <span className="spec-dot" />
            <span>Auth: <strong>Google / Social & Web3 Wallets</strong></span>
          </div>
        </div>
      </section>

      {/* Protocol Architecture Grid */}
      <section className="protocol-pillars">
        <div className="pillar-card">
          <div className="pillar-icon bg-emerald-500/10 text-emerald-400">
            <TreePine className="w-6 h-6" />
          </div>
          <h3>1. Tree-Level Merkle Trees</h3>
          <p>
            Off-chain inventory (unique IDs, species, GPS coordinates, planting timestamps) are hashed into a cryptographic
            Merkle tree. The root is pinned immutably on the MST smart contract.
          </p>
        </div>

        <div className="pillar-card">
          <div className="pillar-icon bg-blue-500/10 text-blue-400">
            <Cpu className="w-6 h-6" />
          </div>
          <h3>2. Zero-Trust Verifier Desk</h3>
          <p>
            Independent verifiers audit stored datasets against on-chain roots, signatures, and run cryptographic proofs
            for randomly sampled tree leaves directly inside the smart contract.
          </p>
        </div>

        <div className="pillar-card">
          <div className="pillar-icon bg-teal-500/10 text-teal-400">
            <Layers className="w-6 h-6" />
          </div>
          <h3>3. ERC-1155 Tokenized Credits</h3>
          <p>
            Verified projects mint audited semi-fungible carbon credits (1 credit = 1 kg CO₂e). Strict on-chain
            checks prevent transfers of revoked, unverified, or expired credits.
          </p>
        </div>

        <div className="pillar-card">
          <div className="pillar-icon bg-rose-500/10 text-rose-400">
            <Flame className="w-6 h-6" />
          </div>
          <h3>4. Permanent On-Chain Retirement</h3>
          <p>
            Companies and individuals burn credits permanently on-chain with recorded justification strings, generating
            verifiable and tamper-proof digital Certificates of Carbon Retirement.
          </p>
        </div>
      </section>

      {/* Interactive Quick Simulator on Landing */}
      <section className="hero-interactive-calc">
        <div className="calc-left">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold">Interactive Carbon Yield Calculator</h3>
          </div>
          <p className="text-sm text-muted mb-4">
            See how many verified carbon credits a tree-planting project can yield on MST Blockchain.
          </p>

          <div className="mb-4">
            <div className="flex justify-between text-sm font-semibold mb-1">
              <span>Plantation Size:</span>
              <span className="text-emerald-400 font-bold">{calcTrees.toLocaleString()} Trees</span>
            </div>
            <input
              type="range"
              min="20"
              max="2000"
              step="10"
              value={calcTrees}
              onChange={(e) => setCalcTrees(Number(e.target.value))}
              className="range-slider"
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>20 trees</span>
              <span>500 trees</span>
              <span>1,000 trees</span>
              <span>2,000 trees</span>
            </div>
          </div>
        </div>

        <div className="calc-right">
          <div className="calc-metric-box">
            <span className="text-xs uppercase text-muted font-bold tracking-wider">Estimated Carbon Yield</span>
            <div className="calc-number-row">
              <span className="calc-number">{estimatedCredits.toLocaleString()}</span>
              <span className="calc-unit">Credits (kg CO₂e)</span>
            </div>
            <p className="text-xs text-emerald-300 font-medium mt-1">
              ≈ {estimatedTonnes} Metric Tonnes of verified carbon removal
            </p>
          </div>
          <button className="btn primary w-full mt-3" onClick={handleConnectWallet}>
            Submit This Plantation On-Chain
          </button>
        </div>
      </section>

      {/* Onboarding Guide */}
      <section className="onboarding-guide">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          Seamless Hackathon Access
        </h3>
        <div className="guide-steps-grid">
          <div className="guide-step">
            <span className="step-num">01</span>
            <strong>Sign In With Google or Web3</strong>
            <p>No seed phrases needed. Reown AppKit creates a secure embedded wallet, or connect MetaMask / BridgeKey.</p>
          </div>
          <div className="guide-step">
            <span className="step-num">02</span>
            <strong>Claim Testnet tMSTC</strong>
            <p>Obtain free testnet tokens from the official faucet to pay for on-chain contract submissions.</p>
          </div>
          <div className="guide-step">
            <span className="step-num">03</span>
            <strong>Submit or Verify Tree Data</strong>
            <p>Upload a CSV of planted trees, cryptographically sign it with your wallet, and submit it for verification.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
