import { useRef } from 'react'
import { Award, CheckCircle2, ExternalLink, Printer, X, ShieldCheck } from 'lucide-react'
import { explorerTx } from '../config/chain'
import { shortAddress } from '../lib/format'

interface Props {
  projectName: string
  location: string
  amount: bigint | number
  reason: string
  account: string
  txHash?: string
  onClose: () => void
}

export function RetirementCertificateModal({
  projectName,
  location,
  amount,
  reason,
  account,
  txHash,
  onClose,
}: Props) {
  const certRef = useRef<HTMLDivElement>(null)

  function printCert() {
    window.print()
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content cert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Award className="w-5 h-5 text-emerald-400" />
            <h3>Official Carbon Offset Certificate</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="cert-wrapper" ref={certRef}>
          <div className="cert-border">
            <div className="cert-inner">
              {/* Header */}
              <div className="cert-header">
                <div className="cert-emblem">
                  <ShieldCheck className="w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="cert-title">CERTIFICATE OF CARBON OFFSET</h2>
                <p className="cert-subtitle">MST Blockchain · Verified On-Chain Retirement</p>
                <div className="cert-divider" />
              </div>

              {/* Recipient */}
              <div className="cert-body">
                <p className="cert-text-lead">This officially certifies that</p>
                <code className="cert-wallet">{account}</code>
                <p className="cert-text-lead">has permanently retired and burned</p>

                <div className="cert-metric-badge">
                  <span className="cert-amount">{Number(amount).toLocaleString()}</span>
                  <span className="cert-unit">kg CO₂e Carbon Credits</span>
                </div>

                <div className="cert-details-grid">
                  <div className="cert-detail-item">
                    <span className="cert-detail-label">Forest Project</span>
                    <strong className="cert-detail-value">{projectName}</strong>
                  </div>
                  <div className="cert-detail-item">
                    <span className="cert-detail-label">Location</span>
                    <strong className="cert-detail-value">{location}</strong>
                  </div>
                  <div className="cert-detail-item">
                    <span className="cert-detail-label">Retirement Purpose</span>
                    <strong className="cert-detail-value">{reason || 'Ecological Footprint Offset'}</strong>
                  </div>
                  <div className="cert-detail-item">
                    <span className="cert-detail-label">Network</span>
                    <strong className="cert-detail-value">MST Testnet (Chain 91562037)</strong>
                  </div>
                </div>

                {txHash && (
                  <div className="cert-tx-box">
                    <span className="text-xs text-muted">Immutable Ledger Proof:</span>
                    <a
                      href={explorerTx(txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cert-tx-link"
                    >
                      <span>{shortAddress(txHash)}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Seal */}
              <div className="cert-footer">
                <div className="cert-seal">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <span>VERIFIED RECORD ON MST CHAIN</span>
                </div>
                <div className="cert-date">
                  <span>Issued: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={printCert}>
            <Printer className="w-4 h-4 mr-1.5 inline" />
            Print / Save Certificate
          </button>
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

