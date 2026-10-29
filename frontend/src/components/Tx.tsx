import { ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { explorerTx } from '../config/chain'
import { shortAddress } from '../lib/format'

interface Props {
  state: 'idle' | 'signing' | 'confirming' | 'success' | 'error'
  hash?: string
  error?: string
  successText?: string
}

export function TxStatus({ state, hash, error, successText = 'Confirmed on MST Blockchain.' }: Props) {
  if (state === 'idle') return null

  return (
    <div className={`tx-status-banner state-${state}`} role={state === 'error' ? 'alert' : 'status'}>
      <div className="tx-status-content">
        {state === 'signing' && (
          <>
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
            <span>Confirm transaction in your wallet…</span>
          </>
        )}

        {state === 'confirming' && (
          <>
            <Loader2 className="w-4 h-4 text-teal-400 animate-spin flex-shrink-0" />
            <span>Broadcasting transaction to MST Testnet…</span>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="font-semibold text-emerald-300">{successText}</span>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="font-semibold text-rose-300">{error || 'Transaction failed.'}</span>
          </>
        )}
      </div>

      {hash && state !== 'signing' && (
        <a
          href={explorerTx(hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="tx-hash-link"
          title="View Transaction on MSTScan"
        >
          <span>Tx: {shortAddress(hash)}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  )
}
