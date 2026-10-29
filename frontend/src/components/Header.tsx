import { useState } from 'react'
import { useAccount, useBalance, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import {
  Coins,
  Copy,
  Check,
  ExternalLink,
  Droplets,
  LogOut,
  Wallet,
  Sparkles,
  TreePine,
  ShieldCheck,
} from 'lucide-react'
import { explorerAddress, MST_CHAIN_ID, MST_FAUCET, MST_EXPLORER } from '../config/chain'
import { shortAddress } from '../lib/format'

export function Header() {
  const { address, isConnected, status, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { open } = useAppKit()
  const balance = useBalance({
    address,
    chainId: MST_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 15_000 },
  })
  const [copied, setCopied] = useState(false)

  const isCorrectNetwork = chainId === MST_CHAIN_ID

  async function copy() {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard fallback
    }
  }

  return (
    <header className="header-bar">
      {/* Brand logo & tagline */}
      <div className="brand-group">
        <div className="brand-badge-glow">
          <TreePine className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="brand-title">CarbonLedger</h1>
            <span className="network-pill-badge">
              <span className="pulse-dot" />
              MST Testnet
            </span>
          </div>
          <p className="brand-tagline">Cryptographic MRV & Tokenized Carbon Credits</p>
        </div>
      </div>

      {/* Network & Wallet Controls */}
      <div className="header-actions">
        {/* Network status pill */}
        <div className="network-status-chip" title="Connected to MST Blockchain Testnet">
          <span className={`status-indicator-dot ${isConnected ? (isCorrectNetwork ? 'online' : 'wrong-net') : 'idle'}`} />
          <span className="network-label">
            {isConnected ? (isCorrectNetwork ? 'Chain 91562037' : 'Wrong Network') : 'MST Testnet'}
          </span>
        </div>

        {/* Faucet link */}
        <a
          href={MST_FAUCET}
          target="_blank"
          rel="noopener noreferrer"
          className="header-tool-btn"
          title="Get free testnet tMSTC tokens"
        >
          <Droplets className="w-3.5 h-3.5 text-blue-400" />
          <span>Faucet</span>
        </a>

        {/* Explorer link */}
        <a
          href={MST_EXPLORER}
          target="_blank"
          rel="noopener noreferrer"
          className="header-tool-btn"
          title="Open MSTScan Block Explorer"
        >
          <ExternalLink className="w-3.5 h-3.5 text-muted" />
          <span>MSTScan</span>
        </a>

        {/* Wallet Area */}
        {isConnected && address ? (
          <div className="wallet-card">
            {/* Balance chip */}
            {balance.data && (
              <div className="balance-badge">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {Number(balance.data.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                  <strong>{balance.data.symbol}</strong>
                </span>
              </div>
            )}

            {/* Address & action dropdown */}
            <div className="wallet-chip">
              <div className="avatar-gradient" />
              <span className="address-text">{shortAddress(address)}</span>

              <button
                className="chip-action-btn"
                onClick={copy}
                title={copied ? 'Copied to clipboard!' : 'Copy full address'}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <a
                className="chip-action-btn"
                href={explorerAddress(address)}
                target="_blank"
                rel="noopener noreferrer"
                title="View on MSTScan"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                className="chip-action-btn"
                onClick={() => open({ view: 'Account' })}
                title="Manage Wallet via AppKit"
              >
                <Wallet className="w-3.5 h-3.5" />
              </button>

              <button
                className="chip-action-btn danger"
                onClick={() => disconnect()}
                title="Disconnect Wallet"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn connect-btn"
            disabled={status === 'connecting' || status === 'reconnecting'}
            onClick={() => open({ view: 'Connect' })}
          >
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span>{status === 'connecting' || status === 'reconnecting' ? 'Connecting…' : 'Connect Wallet / Google'}</span>
          </button>
        )}
      </div>
    </header>
  )
}
