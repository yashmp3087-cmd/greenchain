import type { TreeInput } from './api'

export const MAX_TREES = 5000
export const CSV_HEADER = 'treeId,species,lat,lon,plantedOn'
export const CSV_EXAMPLE = `${CSV_HEADER}\nT-0001,Teak,18.520430,73.856744,2024-06-12\nT-0002,Neem,18.520461,73.856790,2024-06-12`

const NUMBER = /^-?\d+(\.\d+)?$/
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Strict parser: any problem throws with the row number so users can fix their file. */
export function parseTreeCsv(text: string): TreeInput[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error('Add the header row and at least one tree.')
  if (lines[0].replace(/\s/g, '') !== CSV_HEADER) throw new Error(`The first row must be exactly: ${CSV_HEADER}`)
  if (lines.length - 1 > MAX_TREES) throw new Error(`A project can have at most ${MAX_TREES.toLocaleString()} trees.`)

  return lines.slice(1).map((line, i) => {
    const row = i + 2
    const cols = line.split(',').map((c) => c.trim())
    if (cols.length !== 5) throw new Error(`Row ${row}: expected 5 columns, found ${cols.length}.`)
    const [treeId, species, latS, lonS, dateS] = cols
    if (!NUMBER.test(latS) || !NUMBER.test(lonS)) throw new Error(`Row ${row}: lat and lon must be decimal numbers.`)
    const lat = Number(latS)
    const lon = Number(lonS)
    if (lat < -90 || lat > 90) throw new Error(`Row ${row}: lat must be between -90 and 90.`)
    if (lon < -180 || lon > 180) throw new Error(`Row ${row}: lon must be between -180 and 180.`)
    const m = DATE.exec(dateS)
    if (!m) throw new Error(`Row ${row}: plantedOn must look like 2024-06-12.`)
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const ms = Date.UTC(y, mo - 1, d)
    const check = new Date(ms)
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
      throw new Error(`Row ${row}: ${dateS} is not a real date.`)
    }
    if (ms > Date.now()) throw new Error(`Row ${row}: plantedOn is in the future.`)
    return { treeId, species, lat, lon, plantedAt: Math.floor(ms / 1000) }
  })
}
