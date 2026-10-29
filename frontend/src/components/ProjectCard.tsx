import { useState } from 'react'
import { isAddress, zeroAddress, type Address } from 'viem'
import {
  MapPin,
  Trees,
  Coins,
  ShieldCheck,
  Clock,
  ExternalLink,
  Flame,
  Send,
  Award,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertTriangle,
  User,
  Sparkles,
} from 'lucide-react'
import { registryAbi } from '../lib/abi'
import { REGISTRY_ADDRESS, STATUS, STATUS_LABEL, type ProjectWithId } from '../lib/registry'
import { MST_CHAIN_ID, explorerAddress, explorerTx } from '../config/chain'
import { formatDate, formatNumber, shortAddress } from '../lib/format'
import { useBalance1155, useCreditValid, useTx } from '../hooks/useRegistry'
import { api } from '../lib/api'
import { TxStatus } from './Tx'
import { TreeDatasetModal } from './TreeDatasetModal'
import { RetirementCertificateModal } from './RetirementCertificateModal'
import { triggerCelebration, triggerConfetti } from '../lib/confetti'

interface Props {
  project: ProjectWithId
  account: Address
  locked: boolean
}

const PRESET_REASONS = [
  '✈️ Flight Emissions',
  '💻 Cloud & AI Computing',
  '🚗 Commute Footprint',
  '🏆 Hackathon Net-Zero',
]

export function ProjectCard({ project: p, account, locked }: Props) {
  const balance = useBalance1155(account, p.id)
  const valid = useCreditValid(p.id)
  const tx = useTx()
  const [mode, setMode] = useState<'retire' | 'transfer'>('retire')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [to, setTo] = useState('')
  const [formError, setFormError] = useState('')

  // Modals state
  const [showDatasetModal, setShowDatasetModal] = useState(false)
  const [showCertModal, setShowCertModal] = useState(false)
  const [lastRetiredAmount, setLastRetiredAmount] = useState<bigint>(0n)
  const [lastRetiredReason, setLastRetiredReason] = useState('')

  const isOwner = p.owner.toLowerCase() === account.toLowerCase()
  const held = balance.data ?? 0n
  const isValid = valid.data === true
  const canClaim = isOwner && p.status === STATUS.Verified && !p.claimed && isValid
  const expired = p.status === STATUS.Verified && !isValid

  const approvalPercent =
    p.submittedTreeCount > 0
      ? Math.min(100, Math.round((Number(p.verifiedTreeCount) / Number(p.submittedTreeCount)) * 100))
      : 0

  function claim() {
    setFormError('')
    triggerConfetti()
    tx.write({
      address: REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: 'claimCredits',
      args: [p.id],
      chainId: MST_CHAIN_ID,
    })
  }

  function useCredits(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!/^[1-9]\d*$/.test(amount)) return setFormError('Enter a whole number of credits greater than zero.')
    const value = BigInt(amount)
    if (value > held) return setFormError(`You only hold ${formatNumber(held)} credits from this project.`)

    if (mode === 'retire') {
      const why = reason.trim()
      if (!why || why.length > 256) return setFormError('Add a reason (1–256 characters), e.g. “2026 flight emissions”.')
      setLastRetiredAmount(value)
      setLastRetiredReason(why)
      tx.write({
        address: REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: 'retireCredits',
        args: [p.id, value, why],
        chainId: MST_CHAIN_ID,
      })
    } else {
      if (!isAddress(to) || to.toLowerCase() === zeroAddress) return setFormError('Enter a valid recipient address.')
      if (to.toLowerCase() === account.toLowerCase()) return setFormError('You cannot send credits to yourself.')
      tx.write({
        address: REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: 'safeTransferFrom',
        args: [account, to, p.id, value, '0x'],
        chainId: MST_CHAIN_ID,
      })
    }
  }

  function setPercentAmount(pct: number) {
    if (held <= 0n) return
    const calculated = (held * BigInt(pct)) / 100n
    setAmount(calculated > 0n ? calculated.toString() : '1')
  }

  return (
    <>
      <article className={`project-card status-${p.status} ${expired ? 'expired-card' : ''}`}>
        {/* Top Head */}
        <header className="card-header">
          <div className="card-title-group">
            <div className="flex items-center gap-1.5 text-xs text-muted font-medium mb-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{p.location}</span>
              <span>·</span>
              <span className="project-id-chip">#{p.id.toString()}</span>
            </div>
            <h3 className="card-title">{p.name}</h3>
          </div>

          <div className="card-status-badge-wrap">
            <span className={`status-badge badge-${p.status}`}>
              <span className="badge-bullet" />
              {expired ? 'Expired' : STATUS_LABEL[p.status] ?? 'Unknown'}
            </span>
          </div>
        </header>

        {/* Tree Approval Bar */}
        {p.status >= STATUS.Verified && (
          <div className="card-progress-bar-wrap">
            <div className="progress-labels">
              <span className="text-xs text-muted">Audited Trees:</span>
              <span className="text-xs font-semibold text-emerald-400">
                {formatNumber(p.verifiedTreeCount)} / {formatNumber(p.submittedTreeCount)} ({approvalPercent}%)
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${approvalPercent}%` }} />
            </div>
          </div>
        )}

        {/* Core Metrics Grid */}
        <div className="card-metrics-grid">
          <div className="card-metric-cell">
            <span className="metric-cell-label">Trees Submitted</span>
            <div className="metric-cell-value">
              <Trees className="w-3.5 h-3.5 text-emerald-400 inline mr-1" />
              <span>{formatNumber(p.submittedTreeCount)}</span>
            </div>
          </div>

          <div className="card-metric-cell">
            <span className="metric-cell-label">Credits Issued</span>
            <div className="metric-cell-value text-emerald-400">
              <Coins className="w-3.5 h-3.5 inline mr-1" />
              <span>{p.status >= STATUS.Verified ? `${formatNumber(p.creditsIssued)} kg` : 'Pending'}</span>
            </div>
          </div>

          <div className="card-metric-cell">
            <span className="metric-cell-label">Your Balance</span>
            <div className="metric-cell-value">
              <span className={held > 0n ? 'text-amber-400 font-bold' : ''}>{formatNumber(held)}</span>
            </div>
          </div>

          <div className="card-metric-cell">
            <span className="metric-cell-label">{p.status >= STATUS.Verified ? 'Valid Until' : 'Submitted On'}</span>
            <div className="metric-cell-value text-xs">
              <Clock className="w-3.5 h-3.5 text-muted inline mr-1" />
              <span>{formatDate(p.status >= STATUS.Verified ? p.validUntil : p.submittedAt)}</span>
            </div>
          </div>
        </div>

        {/* Owner & Merkle Data Action */}
        <div className="card-links-row">
          <div className="owner-chip">
            <User className="w-3 h-3 text-muted" />
            <span>Owner:</span>
            <a href={explorerAddress(p.owner)} target="_blank" rel="noopener noreferrer" className="owner-link">
              {shortAddress(p.owner)}
            </a>
            {isOwner && <span className="you-pill">You</span>}
          </div>

          <button
            type="button"
            className="view-dataset-btn"
            onClick={() => setShowDatasetModal(true)}
            title="Inspect GPS Tree Dataset & Merkle Root"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Dataset</span>
          </button>
        </div>

        {/* Claim Banner / Button */}
        {canClaim && (
          <div className="claim-action-box">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-300">Ready to Mint to Your Wallet:</span>
              <span className="text-xs font-bold text-emerald-400">{formatNumber(p.creditsIssued)} credits</span>
            </div>
            <button
              className="btn claim-btn"
              disabled={locked || tx.busy}
              onClick={claim}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Claim {formatNumber(p.creditsIssued)} Carbon Credits
            </button>
          </div>
        )}

        {/* Credit Actions: Retire / Transfer */}
        {held > 0n && isValid && (
          <form className="card-actions-form" onSubmit={useCredits} noValidate>
            <div className="seg-tabs" role="group" aria-label="Action type">
              <button
                type="button"
                className={mode === 'retire' ? 'active' : ''}
                onClick={() => setMode('retire')}
              >
                <Flame className="w-3.5 h-3.5 mr-1 text-rose-400 inline" />
                Retire & Burn
              </button>
              <button
                type="button"
                className={mode === 'transfer' ? 'active' : ''}
                onClick={() => setMode('transfer')}
              >
                <Send className="w-3.5 h-3.5 mr-1 text-blue-400 inline" />
                Transfer
              </button>
            </div>

            <div className="action-input-stack">
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <label className="font-semibold text-muted">Amount of Credits:</label>
                  <div className="pct-buttons">
                    <button type="button" onClick={() => setPercentAmount(25)}>25%</button>
                    <button type="button" onClick={() => setPercentAmount(50)}>50%</button>
                    <button type="button" onClick={() => setPercentAmount(100)}>Max</button>
                  </div>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  className="card-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.trim())}
                  placeholder={`Available: ${held.toString()}`}
                />
              </div>

              {mode === 'retire' ? (
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Retirement Justification:</label>
                  <input
                    type="text"
                    className="card-input mb-1.5"
                    value={reason}
                    maxLength={256}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. 2026 Flight Emissions or Hackathon Net-Zero"
                  />
                  <div className="quick-reasons-row">
                    {PRESET_REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="reason-tag"
                        onClick={() => setReason(r.replace(/^[^\s]+\s/, ''))}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Recipient Wallet Address:</label>
                  <input
                    type="text"
                    className="card-input font-mono text-xs"
                    value={to}
                    onChange={(e) => setTo(e.target.value.trim())}
                    placeholder="0x..."
                    spellCheck={false}
                  />
                </div>
              )}

              <button
                className={`btn ${mode === 'retire' ? 'danger-btn' : 'primary'}`}
                disabled={locked || tx.busy}
                type="submit"
              >
                {mode === 'retire' ? (
                  <>
                    <Flame className="w-4 h-4 mr-1.5 inline" />
                    Permanently Burn & Retire
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1.5 inline" />
                    Send Credits
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Notice for frozen or expired credits */}
        {held > 0n && !isValid && (
          <div className="card-notice warning">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p>
              These credits are frozen because this project is{' '}
              {expired ? 'past its validity date' : STATUS_LABEL[p.status].toLowerCase()}.
            </p>
          </div>
        )}

        {/* Error message */}
        {formError && <p className="tx-alert error" role="alert">{formError}</p>}

        {/* Tx Status Line */}
        <TxStatus state={tx.state} hash={tx.hash} error={tx.error} />

        {/* Show Certificate button after successful retirement */}
        {tx.state === 'success' && mode === 'retire' && lastRetiredAmount > 0n && (
          <div className="cert-cta-box">
            <button
              type="button"
              className="btn cert-btn"
              onClick={() => setShowCertModal(true)}
            >
              <Award className="w-4 h-4 text-emerald-400 mr-1.5 inline" />
              View & Print Certificate of Retirement
            </button>
          </div>
        )}
      </article>

      {/* Dataset Modal */}
      {showDatasetModal && (
        <TreeDatasetModal
          root={p.treeDataRoot}
          projectName={p.name}
          onClose={() => setShowDatasetModal(false)}
        />
      )}

      {/* Retirement Certificate Modal */}
      {showCertModal && (
        <RetirementCertificateModal
          projectName={p.name}
          location={p.location}
          amount={lastRetiredAmount}
          reason={lastRetiredReason}
          account={account}
          txHash={tx.hash}
          onClose={() => setShowCertModal(false)}
        />
      )}
    </>
  )
}
