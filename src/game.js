// Pure puzzle logic: no Phaser here so it can be unit tested.
export const N = 1
export const E = 2
export const S = 4
export const W = 8
export const DIRS = [
  { bit: N, dr: -1, dc: 0, opp: S },
  { bit: E, dr: 0, dc: 1, opp: W },
  { bit: S, dr: 1, dc: 0, opp: N },
  { bit: W, dr: 0, dc: -1, opp: E },
]

// Base (rot 0) openings per pipe kind.
export const KINDS = { cap: N, straight: N | S, elbow: N | E, tee: N | E | S, cross: N | E | S | W }

export const rotateMask = (m, times = 1) => {
  let out = m
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) out = ((out << 1) | (out >> 3)) & 15
  return out
}

export const kindOf = (mask) => {
  const bits = [N, E, S, W].filter((b) => mask & b).length
  if (bits === 1) return 'cap'
  if (bits === 4) return 'cross'
  if (bits === 3) return 'tee'
  return mask === (N | S) || mask === (E | W) ? 'straight' : 'elbow'
}

// How many clockwise quarter-turns take the base shape of `kind` to `mask`.
const rotFor = (kind, mask) => {
  for (let r = 0; r < 4; r++) if (rotateMask(KINDS[kind], r) === mask) return r
  throw new Error(`mask ${mask} is not a ${kind}`)
}

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const shuffle = (arr, rnd) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// A random self-avoiding path between two cells; null if the budget runs out.
function findPath(rows, cols, from, to, rnd, minLen) {
  const seen = new Set()
  const path = []
  let budget = 4000
  const key = (r, c) => r * cols + c
  const dfs = (r, c) => {
    if (budget-- <= 0) return false
    seen.add(key(r, c))
    path.push([r, c])
    if (r === to[0] && c === to[1]) {
      if (path.length >= minLen) return true
    } else {
      // Bias toward the target so early levels are not absurdly long.
      const order = shuffle([...DIRS], rnd).sort((a, b) => {
        const da = Math.abs(r + a.dr - to[0]) + Math.abs(c + a.dc - to[1])
        const db = Math.abs(r + b.dr - to[0]) + Math.abs(c + b.dc - to[1])
        return da - db + (rnd() - 0.5) * 3
      })
      for (const d of order) {
        const nr = r + d.dr
        const nc = c + d.dc
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || seen.has(key(nr, nc))) continue
        if (nr === to[0] && nc === to[1] && path.length + 1 < minLen) continue
        if (dfs(nr, nc)) return true
      }
    }
    path.pop()
    seen.delete(key(r, c))
    return false
  }
  return dfs(from[0], from[1]) ? path.slice() : null
}

/**
 * spec: { rows, cols, seed, branches (0..1), decoys (0..1), walls (0..1), locked (0..1), minLen }
 * Returns a puzzle: { rows, cols, tiles[r][c], source:[r,c], drain:[r,c], path, par }
 * tile: { kind|null, rot, solRot, fixed, role: 'source'|'drain'|'path'|'branch'|'decoy'|'wall' }
 */
export function generate(spec) {
  const { rows, cols, seed, branches = 0, decoys = 0.5, walls = 0, locked = 0, minLen = 4 } = spec
  const rnd = mulberry32(seed)
  let path = null
  let from
  let to
  for (let attempt = 0; attempt < 60 && !path; attempt++) {
    from = [Math.floor(rnd() * rows), 0]
    to = [Math.floor(rnd() * rows), cols - 1]
    path = findPath(rows, cols, from, to, rnd, Math.max(2, minLen - Math.floor(attempt / 10)))
  }
  if (!path) {
    // Always solvable fallback: straight run along the top row.
    from = [0, 0]
    to = [0, cols - 1]
    path = Array.from({ length: cols }, (_, c) => [0, c])
  }

  const masks = Array.from({ length: rows }, () => Array(cols).fill(0))
  const role = Array.from({ length: rows }, () => Array(cols).fill(null))
  const connect = ([r1, c1], [r2, c2]) => {
    const d = DIRS.find((x) => r1 + x.dr === r2 && c1 + x.dc === c2)
    masks[r1][c1] |= d.bit
    masks[r2][c2] |= d.opp
  }
  for (let i = 0; i < path.length - 1; i++) connect(path[i], path[i + 1])
  path.forEach(([r, c], i) => (role[r][c] = i === 0 ? 'source' : i === path.length - 1 ? 'drain' : 'path'))

  // Branch: extra opening from a path tile into a neighbouring free cell (makes tees / crosses).
  path.slice(1, -1).forEach(([r, c]) => {
    if (rnd() >= branches) return
    const options = DIRS.filter((d) => {
      const nr = r + d.dr
      const nc = c + d.dc
      return nr >= 0 && nc >= 0 && nr < rows && nc < cols && !role[nr][nc] && !(masks[r][c] & d.bit)
    })
    if (!options.length) return
    const d = options[Math.floor(rnd() * options.length)]
    masks[r][c] |= d.bit
    masks[r + d.dr][c + d.dc] |= d.opp
    role[r + d.dr][c + d.dc] = 'branch'
  })

  const tiles = Array.from({ length: rows }, () => Array(cols).fill(null))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let kind
      let solRot
      let rl = role[r][c]
      if (rl) {
        kind = kindOf(masks[r][c])
        solRot = rotFor(kind, masks[r][c])
      } else if (rnd() < walls) {
        rl = 'wall'
      } else {
        rl = 'decoy'
        kind = rnd() < decoys ? ['straight', 'elbow', 'elbow', 'tee', 'cap'][Math.floor(rnd() * 5)] : 'elbow'
        solRot = Math.floor(rnd() * 4)
      }
      tiles[r][c] = { kind: kind ?? null, rot: solRot ?? 0, solRot: solRot ?? 0, fixed: rl === 'wall' || rl === 'source' || rl === 'drain', role: rl }
    }
  }
  // Lock a few mid-path tiles in their solved orientation (they cannot be turned).
  path.slice(1, -1).forEach(([r, c]) => {
    if (rnd() < locked) tiles[r][c].fixed = true
  })

  const puzzle = { rows, cols, tiles, source: path[0], drain: path[path.length - 1], path, par: 0 }
  // Scramble until it is genuinely unsolved.
  for (let tries = 0; tries < 30; tries++) {
    for (const row of tiles) {
      for (const t of row) if (!t.fixed && t.kind) t.rot = Math.floor(rnd() * 4)
    }
    if (!isSolved(puzzle)) break
    if (tries === 29) {
      const t = path.map(([r, c]) => tiles[r][c]).find((x) => !x.fixed && x.kind !== 'cross')
      if (t) t.rot = (t.solRot + 1) % 4
    }
  }
  puzzle.par = parFor(puzzle)
  return puzzle
}

export const maskOf = (tile) => (tile.kind ? rotateMask(KINDS[tile.kind], tile.rot) : 0)

// Cells wet from the source, with their distance, via mutually open edges.
export function flood(p) {
  const dist = new Map()
  const key = (r, c) => r * p.cols + c
  const q = [p.source]
  dist.set(key(...p.source), 0)
  for (let i = 0; i < q.length; i++) {
    const [r, c] = q[i]
    const m = maskOf(p.tiles[r][c])
    for (const d of DIRS) {
      if (!(m & d.bit)) continue
      const nr = r + d.dr
      const nc = c + d.dc
      if (nr < 0 || nc < 0 || nr >= p.rows || nc >= p.cols || dist.has(key(nr, nc))) continue
      if (!(maskOf(p.tiles[nr][nc]) & d.opp)) continue
      dist.set(key(nr, nc), dist.get(key(r, c)) + 1)
      q.push([nr, nc])
    }
  }
  return dist
}

export const isSolved = (p) => flood(p).has(p.drain[0] * p.cols + p.drain[1])

export const turn = (tile) => {
  if (tile.fixed || !tile.kind) return false
  tile.rot = (tile.rot + 1) % 4
  return true
}

// Minimum clicks (clockwise only) needed to restore every turnable path tile.
export function parFor(p) {
  let total = 0
  for (const [r, c] of p.path) {
    const t = p.tiles[r][c]
    if (t.fixed) continue
    const want = rotateMask(KINDS[t.kind], t.solRot)
    for (let k = 0; k < 4; k++) {
      if (rotateMask(KINDS[t.kind], t.rot + k) === want) {
        total += k
        break
      }
    }
  }
  return total
}

// The first path tile (from the source) that is not yet in a working orientation.
export function hintTile(p) {
  for (const [r, c] of p.path) {
    const t = p.tiles[r][c]
    if (t.fixed) continue
    if (maskOf(t) !== rotateMask(KINDS[t.kind], t.solRot)) return [r, c]
  }
  return null
}

export function starsFor(moves, par) {
  if (moves <= par + 2) return 3
  if (moves <= Math.ceil(par * 1.6) + 4) return 2
  return 1
}

export const TOTAL_LEVELS = 60
export const WORLDS = [
  { name: 'Garden Hose', color: 0x22c55e, bg: ['#0f3d2a', '#06180f'] },
  { name: 'City Plumbing', color: 0x38bdf8, bg: ['#0c3a5c', '#051a2c'] },
  { name: 'Cavern Works', color: 0xf59e0b, bg: ['#4a2a0a', '#1c0e03'] },
  { name: 'Factory Floor', color: 0xf43f5e, bg: ['#4c1226', '#1d0610'] },
  { name: 'Grand Waterworks', color: 0xa78bfa, bg: ['#2e1b5c', '#10082a'] },
]
export const LEVELS_PER_WORLD = 12

export function levelSpec(n) {
  const i = n - 1
  const size = Math.min(9, 4 + Math.floor(i / 12))
  const extraRow = i % 3 === 2 && size < 9 ? 1 : 0
  return {
    rows: size + extraRow,
    cols: size,
    seed: n * 7919 + 13,
    branches: Math.min(0.55, 0.05 + i * 0.012),
    decoys: Math.min(0.85, 0.3 + i * 0.01),
    walls: n > 12 ? Math.min(0.2, (n - 12) * 0.005) : 0,
    locked: n > 24 ? Math.min(0.25, (n - 24) * 0.007) : 0,
    minLen: Math.min(size * size - 2, size + 2 + Math.floor(i / 3)),
  }
}

export const levelPuzzle = (n) => generate(levelSpec(n))

// Rush mode: endless, grows every few solves.
export function rushSpec(solved, seed) {
  const size = Math.min(8, 4 + Math.floor(solved / 3))
  return {
    rows: size,
    cols: size,
    seed,
    branches: Math.min(0.4, 0.1 + solved * 0.02),
    decoys: 0.6,
    walls: solved > 6 ? 0.08 : 0,
    locked: solved > 10 ? 0.1 : 0,
    minLen: size + 2,
  }
}
