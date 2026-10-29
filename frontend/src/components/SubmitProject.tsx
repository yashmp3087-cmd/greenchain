import { useState, useMemo, useRef } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Trees,
  Sparkles,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileText,
  RefreshCw,
} from 'lucide-react'
import { api, type TreeInput } from '../lib/api'
import { CSV_EXAMPLE, CSV_HEADER, MAX_TREES, parseTreeCsv } from '../lib/csv'
import { registryAbi } from '../lib/abi'
import { REGISTRY_ADDRESS } from '../lib/registry'
import { MST_CHAIN_ID } from '../config/chain'
import { errorMessage } from '../lib/format'
import { useTx } from '../hooks/useRegistry'
import { TxStatus } from './Tx'
import { triggerCelebration } from '../lib/confetti'

type Step = 'idle' | 'validating' | 'signing' | 'uploading' | 'chain'
const STEP_TEXT: Record<Step, string> = {
  idle: '',
  validating: '1/4 Validating tree records & checking GPS uniqueness…',
  signing: '2/4 Sign the cryptographic message in your wallet (free, no gas)…',
  uploading: '3/4 Building Merkle tree and pinning dataset off-chain…',
  chain: '4/4 Registering the project on MST Blockchain (Smart Contract call)…',
}

const PRESET_TEMPLATES = [
  {
    name: 'Western Ghats Teak Plantation',
    location: 'Mahabaleshwar, Maharashtra, IN',
    data: `${CSV_HEADER}
WG-001,Teak,17.923412,73.658219,2024-06-10
WG-002,Teak,17.923455,73.658280,2024-06-10
WG-003,Teak,17.923501,73.658340,2024-06-10
WG-004,Teak,17.923549,73.658405,2024-06-10
WG-005,Teak,17.923595,73.658470,2024-06-10
WG-006,Neem,17.923640,73.658535,2024-06-11
WG-007,Neem,17.923685,73.658600,2024-06-11
WG-008,Neem,17.923730,73.658665,2024-06-11
WG-009,Banyan,17.923775,73.658730,2024-06-12
WG-010,Banyan,17.923820,73.658795,2024-06-12`,
  },
  {
    name: 'Sundarbans Coastal Mangrove Restoration',
    location: 'Sundarbans, West Bengal, IN',
    data: `${CSV_HEADER}
SB-M01,Mangrove,21.949712,88.899450,2024-07-01
SB-M02,Mangrove,21.949755,88.899510,2024-07-01
SB-M03,Mangrove,21.949801,88.899570,2024-07-01
SB-M04,Mangrove,21.949845,88.899630,2024-07-01
SB-M05,Mangrove,21.949890,88.899690,2024-07-01
SB-M06,Mangrove,21.949935,88.899750,2024-07-02
SB-M07,Mangrove,21.949980,88.899810,2024-07-02
SB-M08,Mangrove,21.950025,88.899870,2024-07-02`,
  },
  {
    name: 'Deccan Bamboo Carbon Sink',
    location: 'Pune Rural, Maharashtra, IN',
    data: `${CSV_HEADER}
DC-B01,Bamboo,18.520430,73.856744,2024-08-15
DC-B02,Bamboo,18.520461,73.856790,2024-08-15
DC-B03,Bamboo,18.520492,73.856836,2024-08-15
DC-B04,Bamboo,18.520523,73.856882,2024-08-15
DC-B05,Bamboo,18.520554,73.856928,2024-08-15`,
  },
]

export function SubmitProject({ locked }: { locked: boolean }) {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const tx = useTx()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [csv, setCsv] = useState(CSV_EXAMPLE)
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState('')

  const working = step !== 'idle' || tx.busy

  // Parse CSV live for preview and feedback
  const parseResult = useMemo(() => {
    if (!csv.trim()) return { trees: [] as TreeInput[], parseError: '' }
    try {
      const parsed = parseTreeCsv(csv)
      return { trees: parsed, parseError: '' }
    } catch (err: unknown) {
      return { trees: [] as TreeInput[], parseError: err instanceof Error ? err.message : 'Invalid CSV format' }
    }
  }, [csv])

  // Species distribution breakdown
  const speciesCount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of parseResult.trees) {
      counts[t.species] = (counts[t.species] || 0) + 1
    }
    return counts
  }, [parseResult.trees])

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (text) setCsv(text)
    }
    reader.readAsText(file)
  }

  function applyTemplate(tpl: (typeof PRESET_TEMPLATES)[0]) {
    setName(tpl.name)
    setLocation(tpl.location)
    setCsv(tpl.data)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address || working) return
    setError('')
    tx.reset()

    const n = name.trim()
    const l = location.trim()
    if (!n || n.length > 100) return setError('Project name must be 1–100 characters.')
    if (!l || l.length > 100) return setError('Location must be 1–100 characters.')

    let current: Step = 'validating'
    try {
      setStep('validating')
      const trees = parseTreeCsv(csv)
      const prepared = await api.prepare(address, trees)

      current = 'signing'
      setStep('signing')
      const signature = await signMessageAsync({ message: prepared.message })

      current = 'uploading'
      setStep('uploading')
      await api.upload(address, trees, prepared.issuedAt, signature)

      current = 'chain'
      setStep('chain')
      await tx.writeAsync({
        address: REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: 'submitProject',
        args: [n, l, prepared.treeCount, prepared.root, prepared.dataHash, api.datasetUrl(prepared.root)],
        chainId: MST_CHAIN_ID,
      })

      triggerCelebration()
      setName('')
      setLocation('')
      setCsv('')
    } catch (err) {
      if (current !== 'chain') setError(errorMessage(err))
    } finally {
      setStep('idle')
    }
  }

  return (
    <section aria-labelledby="submit-title" className="submit-section">
      <div className="section-head">
        <div className="flex items-center gap-2">
          <Trees className="w-6 h-6 text-emerald-400" />
          <h2 id="submit-title">Register Tree Plantation Project</h2>
        </div>
        <p className="muted">
          Generate an immutable Merkle Tree from GPS tree coordinates and register on the MST Blockchain.
        </p>
      </div>

      {/* Preset demo dataset chooser */}
      <div className="presets-box">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            Quick-Load Hackathon Demo Datasets:
          </span>
        </div>
        <div className="preset-buttons-row">
          {PRESET_TEMPLATES.map((tpl) => (
            <button
              key={tpl.name}
              type="button"
              className="preset-pill-btn"
              onClick={() => applyTemplate(tpl)}
            >
              <span>{tpl.name}</span>
            </button>
          ))}
        </div>
      </div>

      <form className="submit-form" onSubmit={onSubmit} noValidate>
        <fieldset disabled={locked || working} className="submit-fieldset">
          {/* Metadata Row */}
          <div className="form-row-2col">
            <div className="form-group">
              <label className="field-label">
                <FileText className="w-4 h-4 text-emerald-400 inline mr-1" />
                Project Name
              </label>
              <input
                className="card-input"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sahyadri Teak Plantation"
              />
            </div>

            <div className="form-group">
              <label className="field-label">
                <MapPin className="w-4 h-4 text-emerald-400 inline mr-1" />
                Location
              </label>
              <input
                className="card-input"
                value={location}
                maxLength={100}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Pune, Maharashtra, IN"
              />
            </div>
          </div>

          {/* Tree Data CSV Section */}
          <div className="form-group">
            <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
              <label className="field-label mb-0">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 inline mr-1" />
                Tree Inventory (CSV · Max {MAX_TREES.toLocaleString()} trees)
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv"
                  className="hidden-file-input"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  className="tool-link-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="w-3.5 h-3.5 inline mr-1" />
                  Upload .csv File
                </button>
                <button
                  type="button"
                  className="tool-link-btn"
                  onClick={() => setCsv(CSV_EXAMPLE)}
                >
                  Reset Example
                </button>
              </div>
            </div>

            <textarea
              className="csv-textarea"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={8}
              spellCheck={false}
              placeholder={CSV_EXAMPLE}
              aria-describedby="csv-help"
            />
            <p id="csv-help" className="text-xs text-muted mt-1">
              Required format: <code>{CSV_HEADER}</code>. Each tree must have a unique ID, valid latitude (-90 to 90),
              longitude (-180 to 180), and non-future planting date (YYYY-MM-DD).
            </p>
          </div>

          {/* Live CSV Validation Status & Preview */}
          <div className="live-validation-card">
            {parseResult.parseError ? (
              <div className="csv-status-line error">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{parseResult.parseError}</span>
              </div>
            ) : parseResult.trees.length > 0 ? (
              <div className="csv-status-line success">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  <strong>{parseResult.trees.length} valid trees</strong> detected! Ready for cryptographic Merkle hashing.
                </span>
              </div>
            ) : null}

            {/* Species badges */}
            {Object.keys(speciesCount).length > 0 && (
              <div className="species-distribution-row">
                <span className="text-xs text-muted">Species detected:</span>
                {Object.entries(speciesCount).map(([spec, count]) => (
                  <span key={spec} className="species-badge">
                    {spec}: <strong>{count}</strong>
                  </span>
                ))}
              </div>
            )}

            {/* Quick Preview Table of first 3 trees */}
            {parseResult.trees.length > 0 && (
              <div className="csv-mini-preview">
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Species</th>
                      <th>Coordinates</th>
                      <th>Planted Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.trees.slice(0, 3).map((t) => (
                      <tr key={t.treeId}>
                        <td><code>{t.treeId}</code></td>
                        <td><span className="species-pill">{t.species}</span></td>
                        <td>{t.lat.toFixed(4)}°, {t.lon.toFixed(4)}°</td>
                        <td>{new Date(t.plantedAt * 1000).toISOString().split('T')[0]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parseResult.trees.length > 3 && (
                  <span className="text-xs text-muted block mt-1">
                    + {parseResult.trees.length - 3} more trees in dataset
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Submit CTA */}
          <button
            className="btn submit-main-btn"
            type="submit"
            disabled={locked || working || parseResult.trees.length === 0 || !!parseResult.parseError}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            <span>Submit for On-Chain Verification</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </fieldset>
      </form>

      {/* Progress Timeline for Steps */}
      {step !== 'idle' && (
        <div className="timeline-status-card">
          <div className="spinner" />
          <div className="timeline-text">
            <h4>Processing Cryptographic Registration</h4>
            <p>{STEP_TEXT[step]}</p>
          </div>
        </div>
      )}

      {error && <div className="alert-box error" role="alert">{error}</div>}

      <TxStatus
        state={tx.state}
        hash={tx.hash}
        error={tx.error}
        successText="Project registered on MST Blockchain! It now appears in 'My Projects' awaiting verifier audit."
      />
    </section>
  )
}
