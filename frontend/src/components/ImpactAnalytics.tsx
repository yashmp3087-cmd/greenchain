import { useState, useMemo } from 'react'
import {
  Trees,
  CloudRain,
  Flame,
  ShieldCheck,
  Calculator,
  Car,
  Plane,
  Zap,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react'
import { formatNumber } from '../lib/format'
import type { ProjectWithId } from '../lib/registry'

interface Props {
  projects: ProjectWithId[]
}

const SPECIES_FACTORS: Record<string, { co2PerYear: number; description: string; growthSpeed: string }> = {
  Teak: { co2PerYear: 35, description: 'Dense hardwood, durable long-term carbon reservoir', growthSpeed: 'Medium' },
  Neem: { co2PerYear: 28, description: 'Resilient evergreen with medicinal and high-biomass properties', growthSpeed: 'Fast' },
  Mangrove: { co2PerYear: 60, description: 'Blue carbon champion, sequesters 4x more carbon than terrestrial forests', growthSpeed: 'Fast' },
  Bamboo: { co2PerYear: 45, description: 'Ultra-fast biomass accumulator with prolific soil regeneration', growthSpeed: 'Very Fast' },
  Banyan: { co2PerYear: 50, description: 'Massive canopy spreading keystone tree with enormous carbon volume', growthSpeed: 'Slow-Medium' },
}

export function ImpactAnalytics({ projects }: Props) {
  // Aggregate stats from on-chain projects
  const stats = useMemo(() => {
    let totalTrees = 0n
    let approvedTrees = 0n
    let totalCredits = 0n
    let verifiedCount = 0

    for (const p of projects) {
      totalTrees += BigInt(p.submittedTreeCount)
      approvedTrees += BigInt(p.verifiedTreeCount)
      totalCredits += BigInt(p.creditsIssued)
      if (p.status === 2) verifiedCount++
    }

    return {
      totalProjects: projects.length,
      verifiedProjects: verifiedCount,
      totalTrees,
      approvedTrees,
      totalCredits,
      co2Tonnes: (Number(totalCredits) / 1000).toFixed(2),
    }
  }, [projects])

  // Simulator state
  const [species, setSpecies] = useState<string>('Mangrove')
  const [treeCount, setTreeCount] = useState<number>(100)
  const [years, setYears] = useState<number>(5)

  const simulation = useMemo(() => {
    const factor = SPECIES_FACTORS[species]?.co2PerYear ?? 30
    const annualKg = treeCount * factor
    const totalKg = annualKg * years
    const totalTonnes = totalKg / 1000

    // Equivalence calculations
    const carKm = Math.round(totalKg * 4.16) // ~0.24 kg CO2 per km driven
    const flightHours = (totalKg / 90).toFixed(1) // ~90 kg CO2 per passenger hour flight
    const homesMonth = (totalKg / 350).toFixed(1) // ~350 kg CO2 average monthly household energy

    return {
      annualKg,
      totalKg,
      totalTonnes: totalTonnes.toFixed(2),
      carKm,
      flightHours,
      homesMonth,
    }
  }, [species, treeCount, years])

  return (
    <div className="impact-view">
      {/* Header */}
      <div className="section-head">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-emerald-400" />
          <h2>Protocol Analytics & Impact Simulator</h2>
        </div>
        <p className="muted">
          Transparent, verifiable ecological data recorded on the MST Blockchain (Chain ID 91562037).
        </p>
      </div>

      {/* Protocol Metrics Grid */}
      <div className="analytics-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-wrap bg-emerald-500/10 text-emerald-400">
            <Trees className="w-6 h-6" />
          </div>
          <div className="metric-content">
            <span className="metric-label">Total Trees Registered</span>
            <h3 className="metric-value">{formatNumber(stats.totalTrees)}</h3>
            <span className="metric-sub">{formatNumber(stats.approvedTrees)} trees verified on-chain</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap bg-teal-500/10 text-teal-400">
            <CloudRain className="w-6 h-6" />
          </div>
          <div className="metric-content">
            <span className="metric-label">Carbon Sequestered</span>
            <h3 className="metric-value">{formatNumber(stats.totalCredits)} <span className="text-sm font-normal text-muted">kg CO₂e</span></h3>
            <span className="metric-sub">~{stats.co2Tonnes} Metric Tonnes</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap bg-blue-500/10 text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="metric-content">
            <span className="metric-label">Verified Projects</span>
            <h3 className="metric-value">{stats.verifiedProjects} <span className="text-sm font-normal text-muted">/ {stats.totalProjects}</span></h3>
            <span className="metric-sub">Merkle-proof audited</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap bg-purple-500/10 text-purple-400">
            <Layers className="w-6 h-6" />
          </div>
          <div className="metric-content">
            <span className="metric-label">Standard</span>
            <h3 className="metric-value">ERC-1155</h3>
            <span className="metric-sub">Semi-fungible carbon credits</span>
          </div>
        </div>
      </div>

      {/* Interactive Carbon Calculator Simulator */}
      <div className="simulator-card">
        <div className="simulator-header">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-lg">Interactive Carbon Sequestration Calculator</h3>
          </div>
          <span className="badge badge-verified">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Biomass Estimation Model
          </span>
        </div>
        <p className="text-sm text-muted mb-4">
          Test potential reforestation impact across various tree species according to IPCC forestry absorption models.
        </p>

        <div className="simulator-grid">
          {/* Controls */}
          <div className="simulator-controls">
            <div className="control-group">
              <label className="text-sm font-medium">Select Tree Species:</label>
              <div className="species-pills-row">
                {Object.keys(SPECIES_FACTORS).map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    className={`species-btn ${species === sp ? 'active' : ''}`}
                    onClick={() => setSpecies(sp)}
                  >
                    {sp}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted mt-1.5">{SPECIES_FACTORS[species].description}</p>
            </div>

            <div className="control-group">
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium">Number of Trees:</label>
                <span className="text-emerald-400 font-bold">{treeCount.toLocaleString()} trees</span>
              </div>
              <input
                type="range"
                min="10"
                max="5000"
                step="10"
                value={treeCount}
                onChange={(e) => setTreeCount(Number(e.target.value))}
                className="range-slider"
              />
              <div className="flex justify-between text-xs text-muted">
                <span>10</span>
                <span>1,000</span>
                <span>2,500</span>
                <span>5,000</span>
              </div>
            </div>

            <div className="control-group">
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium">Forest Age / Horizon:</label>
                <span className="text-emerald-400 font-bold">{years} Years</span>
              </div>
              <input
                type="range"
                min="1"
                max="25"
                step="1"
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="range-slider"
              />
              <div className="flex justify-between text-xs text-muted">
                <span>1 Year</span>
                <span>10 Years</span>
                <span>25 Years</span>
              </div>
            </div>
          </div>

          {/* Results Display */}
          <div className="simulator-results">
            <div className="result-highlight-card">
              <span className="text-xs uppercase tracking-wider text-muted">Estimated Carbon Offset</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-emerald-400">{simulation.totalKg.toLocaleString()}</span>
                <span className="text-sm font-medium text-muted">kg CO₂e</span>
              </div>
              <span className="text-xs text-emerald-300 font-semibold">
                ≈ {simulation.totalTonnes} Metric Tonnes CO₂ Captured
              </span>
            </div>

            <div className="equivalents-list">
              <span className="text-xs font-semibold uppercase text-muted">Real-World Environmental Equivalence:</span>

              <div className="equivalent-item">
                <div className="eq-icon-wrap bg-blue-500/10 text-blue-400">
                  <Car className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-sm">{simulation.carKm.toLocaleString()} km</strong>
                  <p className="text-xs text-muted">Passenger car travel emissions neutralized</p>
                </div>
              </div>

              <div className="equivalent-item">
                <div className="eq-icon-wrap bg-indigo-500/10 text-indigo-400">
                  <Plane className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-sm">{simulation.flightHours} Flight Hours</strong>
                  <p className="text-xs text-muted">Commercial flight passenger carbon footprint</p>
                </div>
              </div>

              <div className="equivalent-item">
                <div className="eq-icon-wrap bg-amber-500/10 text-amber-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-sm">{simulation.homesMonth} Months</strong>
                  <p className="text-xs text-muted">Average household electricity emissions</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cryptographic Architecture Comparison Card */}
      <div className="protocol-architecture-card">
        <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-teal-400" />
          Why CarbonLedger Outperforms Legacy Carbon Registries
        </h3>
        <div className="comparison-grid">
          <div className="comparison-col legacy">
            <h4 className="text-sm font-bold text-rose-400 mb-2">Legacy Paper Carbon Registries</h4>
            <ul>
              <li>❌ Opaque centralized spreadsheets & manual PDFs</li>
              <li>❌ High double-counting and phantom tree risks</li>
              <li>❌ Slow 6–18 month verification auditing cycles</li>
              <li>❌ Opaque broker markups and high intermediary fees</li>
              <li>❌ No cryptographic proof linking credits to specific trees</li>
            </ul>
          </div>
          <div className="comparison-col carbonledger">
            <h4 className="text-sm font-bold text-emerald-400 mb-2">CarbonLedger on MST Blockchain</h4>
            <ul>
              <li>✅ Immutable on-chain Merkle Roots & keccak256 evidence</li>
              <li>✅ Cryptographic leaf proofs with unique GPS coordinates</li>
              <li>✅ Instant decentralized verifier desk validation</li>
              <li>✅ Zero middlemen: Direct ERC-1155 tokenized claim & retirement</li>
              <li>✅ On-chain retirement receipts with permanent burn events</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

