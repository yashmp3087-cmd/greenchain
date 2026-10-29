import { useState } from 'react'
import { usePublicClient } from 'wagmi'
import type { Address } from 'viem'
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Trees,
  Coins,
  MapPin,
  ExternalLink,
  Clock,
  Sparkles,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { registryAbi } from '../lib/abi'
import { REGISTRY_ADDRESS, STATUS, type ProjectWithId } from '../lib/registry'
import { MST_CHAIN_ID, explorerAddress } from '../config/chain'
import { api } from '../lib/api'
import { errorMessage, formatNumber, shortAddress } from '../lib/format'
import { useProjects, useTx } from '../hooks/useRegistry'
import { TxStatus } from './Tx'
import { triggerCelebration } from '../lib/confetti'

interface Check {
  ok: boolean
  text: string
}
const SAMPLE_SIZE = 5

function pickSample(ids: string[], n: number): string[] {
  const pool = [...ids]
  const out: string[] = []
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  }
  return out
}

function ReviewCard({
  project: p,
  account,
  locked,
}: {
  project: ProjectWithId
  account: Address
  locked: boolean
}) {
  const client = usePublicClient({ chainId: MST_CHAIN_ID })
  const tx = useTx()
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [auditing, setAuditing] = useState(false)
  const [approved, setApproved] = useState(p.submittedTreeCount.toString())
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [showDangerZone, setShowDangerZone] = useState(false)

  const isOwner = p.owner.toLowerCase() === account.toLowerCase()
  const passed = !!checks && checks.every((c) => c.ok)
  const pending = p.status === STATUS.Pending

  async function audit() {
    setAuditing(true)
    setError('')
    setChecks(null)
    const out: Check[] = []
    try {
      const ds = await api.dataset(p.treeDataRoot)
      out.push({
        ok: ds.root.toLowerCase() === p.treeDataRoot.toLowerCase(),
        text: 'Stored dataset matches on-chain Merkle root',
      })
      out.push({
        ok: ds.dataHash.toLowerCase() === p.evidenceHash.toLowerCase(),
        text: 'Evidence hash matches dataset content integrity',
      })
      out.push({
        ok: ds.submitter.toLowerCase() === p.owner.toLowerCase(),
        text: 'Dataset was signed by the registered owner address',
      })
      out.push({
        ok: ds.treeCount === p.submittedTreeCount,
        text: `Tree inventory count matches exactly (${ds.treeCount} trees)`,
      })

      if (!client) throw new Error('No connection to MST Testnet.')
      const sample = pickSample(ds.trees.map((t) => t.treeId), SAMPLE_SIZE)
      let good = 0
      for (const id of sample) {
        const pr = await api.proof(p.treeDataRoot, id)
        const inTree = await client.readContract({
          address: REGISTRY_ADDRESS,
          abi: registryAbi,
          functionName: 'verifyTreeRecord',
          args: [p.id, pr.leaf, pr.proof],
        })
        if (inTree) good++
      }
      out.push({
        ok: good === sample.length,
        text: `${good}/${sample.length} sampled tree leaves cryptographically verified on MST contract`,
      })
    } catch (e) {
      out.push({ ok: false, text: errorMessage(e) })
    } finally {
      setChecks(out)
      setAuditing(false)
    }
  }

  function approve() {
    setError('')
    if (!/^[1-9]\d*$/.test(approved) || BigInt(approved) > BigInt(p.submittedTreeCount)) {
      return setError(`Approve between 1 and ${p.submittedTreeCount} trees.`)
    }
    triggerCelebration()
    tx.write({
      address: REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: 'verifyProject',
      args: [p.id, Number(approved)],
      chainId: MST_CHAIN_ID,
    })
  }

  function decide(fn: 'rejectProject' | 'revokeProject') {
    setError('')
    const why = reason.trim()
    if (!why || why.length > 256) return setError('Give a reason (1–256 characters).')
    tx.write({
      address: REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: fn,
      args: [p.id, why],
      chainId: MST_CHAIN_ID,
    })
  }

  return (
    <article className="audit-card">
      <header className="audit-header">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>{p.location}</span>
            <span>·</span>
            <span>Project #{p.id.toString()}</span>
          </div>
          <h3 className="text-lg font-bold">{p.name}</h3>
        </div>

        <div className="owner-badge-box">
          <span className="text-xs text-muted">Owner:</span>
          <a
            href={explorerAddress(p.owner)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-emerald-400"
          >
            {shortAddress(p.owner)}
          </a>
        </div>
      </header>

      {isOwner && (
        <div className="alert-box warning">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Conflict of Interest: You own this project. Smart contract forbids self-verification. Another verifier must review.</span>
        </div>
      )}

      {pending && (
        <div className="audit-body">
          {/* Audit Verification Step */}
          <div className="audit-step-box">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Cryptographic Dataset Audit
              </span>
              <button
                className="btn audit-run-btn"
                onClick={audit}
                disabled={auditing || locked}
              >
                <Play className="w-3.5 h-3.5 inline mr-1" />
                {auditing ? 'Running On-Chain Checks…' : 'Run Data Checks'}
              </button>
            </div>

            {checks ? (
              <ul className="check-results-list">
                {checks.map((c) => (
                  <li key={c.text} className={c.ok ? 'check-pass' : 'check-fail'}>
                    {c.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    )}
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">
                Runs 5 independent verification routines including on-chain Merkle leaf proofs against the smart contract.
              </p>
            )}
          </div>

          {/* Approval Section */}
          <div className="approval-control-box">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold">Trees to Approve for Credits:</label>
              <button
                type="button"
                className="tool-link-btn"
                onClick={() => setApproved(p.submittedTreeCount.toString())}
              >
                Approve 100% ({p.submittedTreeCount} trees)
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                min="1"
                max={p.submittedTreeCount.toString()}
                className="card-input"
                value={approved}
                onChange={(e) => setApproved(e.target.value.trim())}
              />
              <span className="text-xs text-muted whitespace-nowrap">/ {p.submittedTreeCount} trees</span>
            </div>

            <button
              className="btn primary w-full"
              disabled={!passed || isOwner || locked || tx.busy}
              onClick={approve}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5 inline" />
              Verify & Approve On-Chain
            </button>
            {!passed && !isOwner && (
              <p className="text-xs text-muted text-center mt-1.5">
                Run data checks first. Approval unlocks once all checks pass.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Danger Zone: Reject or Revoke */}
      <div className="danger-zone-box">
        <button
          type="button"
          className="danger-zone-toggle"
          onClick={() => setShowDangerZone(!showDangerZone)}
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {pending ? 'Reject This Project' : 'Revoke Verified Project (Freeze Credits)'}
          </span>
          {showDangerZone ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showDangerZone && (
          <div className="danger-zone-content">
            <label className="text-xs font-semibold text-muted block mb-1">
              Audit Rejection / Revocation Reason:
            </label>
            <input
              type="text"
              className="card-input mb-2"
              value={reason}
              maxLength={256}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Inconsistent GPS boundary or duplicate survey records"
            />
            <button
              className="btn danger-btn w-full"
              disabled={isOwner && pending ? true : locked || tx.busy}
              onClick={() => decide(pending ? 'rejectProject' : 'revokeProject')}
            >
              {pending ? 'Confirm Project Rejection' : 'Revoke Project & Freeze All Credits'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert-box error" role="alert">{error}</div>}
      <TxStatus state={tx.state} hash={tx.hash} error={tx.error} />
    </article>
  )
}

export function VerifierPanel({ account, locked }: { account: Address; locked: boolean }) {
  const { projects, isLoading } = useProjects()
  const pending = projects.filter((p) => p.status === STATUS.Pending)
  const verified = projects.filter((p) => p.status === STATUS.Verified)

  return (
    <section aria-labelledby="verifier-title" className="verifier-section">
      <div className="section-head">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <h2 id="verifier-title">Verifier Audit Desk</h2>
        </div>
        <p className="muted">
          Perform zero-trust cryptographic validation on submitted tree datasets before approving carbon credit issuance.
        </p>
      </div>

      {/* Sub-sections */}
      <div className="audit-queue-header">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h3 className="text-base font-bold">Pending Review Queue ({pending.length})</h3>
        </div>
        <span className="text-xs text-muted">Awaiting verifier cryptographic check</span>
      </div>

      {isLoading && (
        <div className="loading-card">
          <div className="spinner" />
          <p>Loading projects for review…</p>
        </div>
      )}

      {!isLoading && pending.length === 0 && (
        <div className="empty-state-card mini">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 mb-1" />
          <p className="font-semibold text-sm">Review queue is empty</p>
          <span className="text-xs text-muted">All submitted datasets have been processed.</span>
        </div>
      )}

      <div className="grid">
        {pending.map((p) => (
          <ReviewCard key={p.id.toString()} project={p} account={account} locked={locked} />
        ))}
      </div>

      {/* Verified projects queue for monitoring and revocation */}
      <div className="audit-queue-header mt-8">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <h3 className="text-base font-bold">Verified Projects ({verified.length})</h3>
        </div>
        <span className="text-xs text-muted">Authorized credits active on MST Testnet</span>
      </div>

      <div className="grid">
        {verified.map((p) => (
          <ReviewCard key={p.id.toString()} project={p} account={account} locked={locked} />
        ))}
      </div>
    </section>
  )
}
