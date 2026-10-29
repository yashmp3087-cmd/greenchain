import { useState } from 'react'
import { isAddress, zeroAddress } from 'viem'
import {
  ShieldAlert,
  UserCheck,
  UserX,
  Gauge,
  AlertOctagon,
  CheckCircle2,
  Sliders,
  Sparkles,
} from 'lucide-react'
import { registryAbi } from '../lib/abi'
import { REGISTRY_ADDRESS, VERIFIER_ROLE } from '../lib/registry'
import { MST_CHAIN_ID } from '../config/chain'
import { useTx } from '../hooks/useRegistry'
import { TxStatus } from './Tx'

export function AdminPanel({
  paused,
  creditsPerTree,
  locked,
}: {
  paused: boolean
  creditsPerTree?: bigint
  locked: boolean
}) {
  const tx = useTx()
  const [verifier, setVerifier] = useState('')
  const [rate, setRate] = useState(creditsPerTree?.toString() ?? '50')
  const [error, setError] = useState('')

  function role(fn: 'grantRole' | 'revokeRole') {
    setError('')
    if (!isAddress(verifier) || verifier.toLowerCase() === zeroAddress) {
      return setError('Enter a valid wallet address.')
    }
    tx.write({
      address: REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: fn,
      args: [VERIFIER_ROLE, verifier],
      chainId: MST_CHAIN_ID,
    })
  }

  function setRateTx() {
    setError('')
    if (!/^[1-9]\d{0,3}$/.test(rate) || Number(rate) > 1000) {
      return setError('Enter a whole number from 1 to 1000.')
    }
    tx.write({
      address: REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: 'setCreditsPerTree',
      args: [BigInt(rate)],
      chainId: MST_CHAIN_ID,
    })
  }

  return (
    <section aria-labelledby="admin-title" className="admin-section">
      <div className="section-head">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-amber-400" />
          <h2 id="admin-title">Protocol Administration</h2>
        </div>
        <p className="muted">
          Smart contract governance controls. Restricted to the Default Admin Role on MST Blockchain.
        </p>
      </div>

      <div className="admin-grid">
        {/* Verifier Role Management */}
        <article className="admin-card">
          <div className="admin-card-head">
            <div className="admin-icon-wrap bg-blue-500/10 text-blue-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Verifier Authorization</h3>
              <p className="text-xs text-muted">Grant or revoke the VERIFIER_ROLE for audit authorities</p>
            </div>
          </div>

          <div className="admin-card-body">
            <label className="text-xs font-semibold text-muted mb-1 block">Candidate Wallet Address:</label>
            <input
              className="card-input font-mono text-xs mb-3"
              value={verifier}
              onChange={(e) => setVerifier(e.target.value.trim())}
              placeholder="0x..."
              spellCheck={false}
            />

            <div className="flex gap-2">
              <button
                className="btn primary flex-1"
                disabled={locked || tx.busy}
                onClick={() => role('grantRole')}
              >
                <UserCheck className="w-3.5 h-3.5 mr-1 inline" />
                Grant Verifier
              </button>
              <button
                className="btn danger-btn flex-1"
                disabled={locked || tx.busy}
                onClick={() => role('revokeRole')}
              >
                <UserX className="w-3.5 h-3.5 mr-1 inline" />
                Revoke Role
              </button>
            </div>
          </div>
        </article>

        {/* Credit Rate Configuration */}
        <article className="admin-card">
          <div className="admin-card-head">
            <div className="admin-icon-wrap bg-emerald-500/10 text-emerald-400">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Credits Issuance Rate</h3>
              <p className="text-xs text-muted">Currently {creditsPerTree?.toString() ?? '50'} kg CO₂e per verified tree</p>
            </div>
          </div>

          <div className="admin-card-body">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-muted">New Rate (1–1000 kg):</label>
              <span className="text-sm font-bold text-emerald-400">{rate} kg / tree</span>
            </div>
            <input
              type="number"
              min="1"
              max="1000"
              className="card-input mb-3"
              value={rate}
              onChange={(e) => setRate(e.target.value.trim())}
            />

            <button className="btn w-full" disabled={locked || tx.busy} onClick={setRateTx}>
              <Sliders className="w-3.5 h-3.5 mr-1 inline" />
              Update Issuance Rate
            </button>
          </div>
        </article>

        {/* Emergency Stop / Circuit Breaker */}
        <article className="admin-card emergency-card">
          <div className="admin-card-head">
            <div className="admin-icon-wrap bg-rose-500/10 text-rose-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Circuit Breaker</h3>
              <p className="text-xs text-muted">
                {paused
                  ? 'Registry is currently PAUSED. Submissions, claims, and transfers are stopped.'
                  : 'Emergency stop: Halts submissions, audits, claims, transfers and retirements.'}
              </p>
            </div>
          </div>

          <div className="admin-card-body">
            <div className={`circuit-status-box ${paused ? 'paused' : 'active'}`}>
              <span className="circuit-status-dot" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Protocol Status: {paused ? 'PAUSED' : 'ACTIVE & RUNNING'}
              </span>
            </div>

            <button
              className={`btn w-full ${paused ? 'primary' : 'danger-btn'}`}
              disabled={tx.busy || (locked && !paused)}
              onClick={() =>
                tx.write({
                  address: REGISTRY_ADDRESS,
                  abi: registryAbi,
                  functionName: paused ? 'unpause' : 'pause',
                  chainId: MST_CHAIN_ID,
                })
              }
            >
              <AlertOctagon className="w-4 h-4 mr-1.5 inline" />
              {paused ? 'Resume Registry Operations' : 'Trigger Emergency Pause'}
            </button>
          </div>
        </article>
      </div>

      {error && <div className="alert-box error" role="alert">{error}</div>}
      <TxStatus state={tx.state} hash={tx.hash} error={tx.error} />
    </section>
  )
}
