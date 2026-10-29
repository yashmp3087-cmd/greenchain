import { useEffect, useState, useMemo } from 'react'
import { X, Search, Copy, Check, Trees, ExternalLink, MapPin } from 'lucide-react'
import { api, type Dataset, type StoredTree } from '../lib/api'
import { formatDate, shortAddress } from '../lib/format'
import { MST_EXPLORER } from '../config/chain'

interface Props {
  root: string
  projectName: string
  onClose: () => void
}

export function TreeDatasetModal({ root, projectName, onClose }: Props) {
  const [data, setData] = useState<Dataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [copiedRoot, setCopiedRoot] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)
  const [selectedTree, setSelectedTree] = useState<StoredTree | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api
      .dataset(root)
      .then((res) => {
        if (active) {
          setData(res)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Failed to fetch tree dataset')
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [root])

  const filteredTrees = useMemo(() => {
    if (!data?.trees) return []
    if (!filter.trim()) return data.trees
    const q = filter.toLowerCase().trim()
    return data.trees.filter(
      (t) => t.treeId.toLowerCase().includes(q) || t.species.toLowerCase().includes(q),
    )
  }, [data, filter])

  const mapBounds = useMemo(() => {
    if (!data?.trees || data.trees.length === 0) return null
    let minLat = Infinity,
      maxLat = -Infinity,
      minLon = Infinity,
      maxLon = -Infinity
    for (const t of data.trees) {
      const lat = t.latE6 / 1e6
      const lon = t.lonE6 / 1e6
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
    }
    const padLat = Math.max((maxLat - minLat) * 0.15, 0.001)
    const padLon = Math.max((maxLon - minLon) * 0.15, 0.001)
    return {
      minLat: minLat - padLat,
      maxLat: maxLat + padLat,
      minLon: minLon - padLon,
      maxLon: maxLon + padLon,
    }
  }, [data])

  async function copyText(txt: string, setCopied: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(txt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // fallback
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Trees className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3>Tree Inventory & Merkle Dataset</h3>
              <p className="modal-subtitle">{projectName}</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="loading-box">
              <div className="spinner" />
              <p>Fetching cryptographic dataset from storage…</p>
            </div>
          )}

          {error && (
            <div className="alert-box error">
              <p>{error}</p>
              <p className="text-xs text-muted">Is the CarbonLedger backend running on localhost:8787?</p>
            </div>
          )}

          {data && (
            <div className="modal-data-flow">
              {/* Cryptographic Hashes bar */}
              <div className="crypto-details-card">
                <div className="crypto-field">
                  <span className="crypto-label">Merkle Tree Root:</span>
                  <code className="crypto-code" title={data.root}>
                    {data.root}
                  </code>
                  <button
                    className="copy-chip"
                    onClick={() => copyText(data.root, setCopiedRoot)}
                    title="Copy Merkle Root"
                  >
                    {copiedRoot ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRoot ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="crypto-field">
                  <span className="crypto-label">Evidence Hash:</span>
                  <code className="crypto-code" title={data.dataHash}>
                    {data.dataHash}
                  </code>
                  <button
                    className="copy-chip"
                    onClick={() => copyText(data.dataHash, setCopiedHash)}
                    title="Copy Evidence Hash"
                  >
                    {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="crypto-meta-row">
                  <span>Submitter: <strong>{shortAddress(data.submitter)}</strong></span>
                  <span>Total Trees: <strong>{data.treeCount}</strong></span>
                  <a
                    href={api.datasetUrl(root)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-with-icon"
                  >
                    <span>Raw JSON API</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Interactive Visual Map / Coordinate Scatter */}
              {mapBounds && (
                <div className="geo-scatter-container">
                  <div className="geo-header">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <MapPin className="w-3.5 h-3.5" />
                      GPS Coordinate Scatter Plot (Field Distribution)
                    </span>
                    {selectedTree && (
                      <span className="text-xs text-emerald-300">
                        Selected: <strong>{selectedTree.treeId}</strong> ({selectedTree.species})
                      </span>
                    )}
                  </div>
                  <div className="geo-plot-svg-wrap">
                    <svg
                      viewBox="0 0 500 200"
                      className="geo-svg"
                      preserveAspectRatio="none"
                    >
                      {/* Grid background */}
                      <defs>
                        <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
                          <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />

                      {data.trees.map((t) => {
                        const lat = t.latE6 / 1e6
                        const lon = t.lonE6 / 1e6
                        const x =
                          ((lon - mapBounds.minLon) / (mapBounds.maxLon - mapBounds.minLon)) * 460 + 20
                        const y =
                          200 -
                          (((lat - mapBounds.minLat) / (mapBounds.maxLat - mapBounds.minLat)) * 160 + 20)
                        const isSelected = selectedTree?.treeId === t.treeId

                        return (
                          <g key={t.treeId} onClick={() => setSelectedTree(t)} className="tree-plot-point">
                            <circle
                              cx={x}
                              cy={y}
                              r={isSelected ? 6 : 3.5}
                              className={isSelected ? 'plot-circle active' : 'plot-circle'}
                            />
                            <title>{`${t.treeId} - ${t.species}\nLat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`}</title>
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                </div>
              )}

              {/* Trees Table with Search */}
              <div className="table-controls">
                <div className="search-bar">
                  <Search className="w-4 h-4 text-muted" />
                  <input
                    type="text"
                    placeholder="Search by Tree ID or Species..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  {filter && (
                    <button className="clear-btn" onClick={() => setFilter('')}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span className="results-badge">
                  Showing {filteredTrees.length} of {data.treeCount} trees
                </span>
              </div>

              <div className="table-responsive">
                <table className="tree-data-table">
                  <thead>
                    <tr>
                      <th>Tree ID</th>
                      <th>Species</th>
                      <th>Latitude</th>
                      <th>Longitude</th>
                      <th>Planted Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrees.slice(0, 100).map((t) => (
                      <tr
                        key={t.treeId}
                        className={selectedTree?.treeId === t.treeId ? 'row-selected' : ''}
                        onClick={() => setSelectedTree(t)}
                      >
                        <td>
                          <code className="tree-id-code">{t.treeId}</code>
                        </td>
                        <td>
                          <span className="species-pill">{t.species}</span>
                        </td>
                        <td className="coord-cell">{(t.latE6 / 1e6).toFixed(6)}°</td>
                        <td className="coord-cell">{(t.lonE6 / 1e6).toFixed(6)}°</td>
                        <td className="date-cell">{formatDate(t.plantedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredTrees.length > 100 && (
                <p className="table-footer-notice">
                  Showing first 100 records of {filteredTrees.length} matching trees.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
