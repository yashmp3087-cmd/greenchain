import { useState, useMemo } from 'react'
import type { Address } from 'viem'
import {
  Search,
  Filter,
  ArrowUpDown,
  Grid,
  List,
  Sparkles,
  Trees,
  CheckCircle2,
  Clock,
  PlusCircle,
  X,
  Layers,
} from 'lucide-react'
import { useProjects } from '../hooks/useRegistry'
import { errorMessage, formatNumber } from '../lib/format'
import { STATUS, type ProjectWithId } from '../lib/registry'
import { ProjectCard } from './ProjectCard'

interface Props {
  account: Address
  locked: boolean
  mineOnly?: boolean
  onNavigateSubmit?: () => void
}

export function ProjectsView({ account, locked, mineOnly, onNavigateSubmit }: Props) {
  const { projects, total, isLoading, error } = useProjects()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'trees' | 'credits'>('newest')
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid')

  // Filter and sort
  const filteredProjects = useMemo(() => {
    let list = mineOnly
      ? projects.filter((p) => p.owner.toLowerCase() === account.toLowerCase())
      : [...projects]

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.owner.toLowerCase().includes(q) ||
          p.id.toString().includes(q),
      )
    }

    // Status filter
    if (statusFilter === 'verified') {
      list = list.filter((p) => p.status === STATUS.Verified)
    } else if (statusFilter === 'pending') {
      list = list.filter((p) => p.status === STATUS.Pending)
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'trees') {
        return Number(b.submittedTreeCount - a.submittedTreeCount)
      }
      if (sortBy === 'credits') {
        return Number(b.creditsIssued - a.creditsIssued)
      }
      return Number(b.id - a.id) // newest first
    })

    return list
  }, [projects, mineOnly, account, search, statusFilter, sortBy])

  // Aggregate stats
  const stats = useMemo(() => {
    let trees = 0n
    let credits = 0n
    let verifiedCount = 0
    for (const p of projects) {
      trees += BigInt(p.submittedTreeCount)
      credits += BigInt(p.creditsIssued)
      if (p.status === STATUS.Verified) verifiedCount++
    }
    return {
      totalCount: projects.length,
      verifiedCount,
      trees,
      credits,
    }
  }, [projects])

  return (
    <section aria-labelledby="projects-title" className="projects-section">
      {/* Top Banner Stats */}
      <div className="section-head-with-stats">
        <div>
          <div className="flex items-center gap-2">
            <Trees className="w-6 h-6 text-emerald-400" />
            <h2 id="projects-title">{mineOnly ? 'My Projects & Portfolio' : 'Carbon Credit Registry'}</h2>
          </div>
          <p className="muted">
            {mineOnly
              ? 'View your registered plantations, claim verified credits, and manage retirement certificates.'
              : 'Decentralized forest inventory recorded on the MST Blockchain.'}
          </p>
        </div>

        {!mineOnly && (
          <div className="quick-stats-strip">
            <div className="stat-pill">
              <span className="stat-pill-label">Total Projects</span>
              <strong className="stat-pill-val">{stats.totalCount}</strong>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-label">Verified</span>
              <strong className="stat-pill-val text-emerald-400">{stats.verifiedCount}</strong>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-label">Total Trees</span>
              <strong className="stat-pill-val">{formatNumber(stats.trees)}</strong>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-label">Credits (kg CO₂e)</span>
              <strong className="stat-pill-val text-emerald-400">{formatNumber(stats.credits)}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-toolbar">
        {/* Search */}
        <div className="search-input-wrap">
          <Search className="w-4 h-4 text-muted search-icon" />
          <input
            type="text"
            className="filter-search-input"
            placeholder="Search projects by name, location, ID or wallet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear-btn" onClick={() => setSearch('')}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status filters */}
        <div className="filter-group">
          <div className="seg-pill" role="group">
            <button
              className={statusFilter === 'all' ? 'active' : ''}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button
              className={statusFilter === 'verified' ? 'active' : ''}
              onClick={() => setStatusFilter('verified')}
            >
              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
              Verified
            </button>
            <button
              className={statusFilter === 'pending' ? 'active' : ''}
              onClick={() => setStatusFilter('pending')}
            >
              <Clock className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
              Pending
            </button>
          </div>

          {/* Sort By */}
          <div className="sort-select-wrap">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'trees' | 'credits')}
              className="select-custom"
            >
              <option value="newest">Newest First</option>
              <option value="trees">Most Trees</option>
              <option value="credits">Most Credits</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert-box error" role="alert">Could not load projects: {errorMessage(error)}</div>}

      {isLoading && (
        <div className="loading-card">
          <div className="spinner" />
          <p>Syncing registry state from MST Testnet…</p>
        </div>
      )}

      {!isLoading && filteredProjects.length === 0 && (
        <div className="empty-state-card">
          <div className="empty-icon-wrap">
            <Trees className="w-10 h-10 text-emerald-400" />
          </div>
          <h3>{search || statusFilter !== 'all' ? 'No matching projects found' : mineOnly ? 'No Projects Submitted Yet' : 'No Projects Registered Yet'}</h3>
          <p className="empty-desc">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search criteria or filters.'
              : mineOnly
                ? 'Register your tree-planting plantation to get verified and receive tokenized carbon credits on MST Testnet.'
                : 'Be the pioneer! Submit the first forestry dataset to start generating audited carbon credits on MST blockchain.'}
          </p>
          {onNavigateSubmit && (
            <button className="btn primary" onClick={onNavigateSubmit}>
              <PlusCircle className="w-4 h-4 mr-1.5 inline" />
              Submit Tree Project
            </button>
          )}
        </div>
      )}

      <div className="grid">
        {filteredProjects.map((p) => (
          <ProjectCard key={p.id.toString()} project={p} account={account} locked={locked} />
        ))}
      </div>
    </section>
  )
}
