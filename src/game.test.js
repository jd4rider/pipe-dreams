import test from 'node:test'
import assert from 'node:assert/strict'
import { generate, levelPuzzle, isSolved, turn, flood, parFor, hintTile, rotateMask, kindOf, KINDS, starsFor, TOTAL_LEVELS, rushSpec, maskOf, isWrapLevel, N, E, S, W } from './game.js'

test('rotateMask cycles clockwise', () => {
  assert.equal(rotateMask(N), E)
  assert.equal(rotateMask(N | E), E | S)
  assert.equal(rotateMask(N | S, 2), N | S)
  assert.equal(kindOf(E | W), 'straight')
  assert.equal(kindOf(N | W), 'elbow')
  assert.equal(KINDS.cross, 15)
})

test('every journey level is solvable and starts unsolved', () => {
  for (let n = 1; n <= TOTAL_LEVELS; n++) {
    const p = levelPuzzle(n)
    assert.ok(!isSolved(p), `level ${n} starts solved`)
    // Restore the solution orientation.
    for (const row of p.tiles) for (const t of row) if (t.kind) t.rot = t.solRot
    assert.ok(isSolved(p), `level ${n} unsolvable`)
  }
})

test('turning the par number of tiles solves a level', () => {
  for (const n of [1, 10, 30, 60]) {
    const p = levelPuzzle(n)
    let clicks = 0
    let guard = 0
    while (!isSolved(p) && guard++ < 500) {
      const h = hintTile(p)
      assert.ok(h, 'hint available while unsolved')
      turn(p.tiles[h[0]][h[1]])
      clicks++
    }
    assert.ok(isSolved(p))
    assert.ok(clicks >= 1 && clicks <= parFor(levelPuzzle(n)) + 1, `level ${n}: ${clicks} clicks vs par`)
  }
})

test('fixed tiles do not turn and flood spreads from the source', () => {
  const p = generate({ rows: 4, cols: 4, seed: 5 })
  const [sr, sc] = p.source
  const before = maskOf(p.tiles[sr][sc])
  assert.equal(turn(p.tiles[sr][sc]), false)
  assert.equal(maskOf(p.tiles[sr][sc]), before)
  assert.equal(flood(p).get(sr * p.cols + sc), 0)
})

test('generation is deterministic and rush grows', () => {
  assert.deepEqual(levelPuzzle(7).tiles, levelPuzzle(7).tiles)
  assert.ok(rushSpec(12, 1).rows > rushSpec(0, 1).rows)
  const p = generate(rushSpec(9, 99))
  for (const row of p.tiles) for (const t of row) if (t.kind) t.rot = t.solRot
  assert.ok(isSolved(p))
})

test('star rating rewards efficiency', () => {
  assert.equal(starsFor(10, 10), 3)
  assert.equal(starsFor(20, 10), 2)
  assert.equal(starsFor(60, 10), 1)
})

test('wrap levels route water through the board edges', () => {
  const wraps = Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).filter(isWrapLevel)
  assert.ok(wraps.length > 5)
  for (const n of wraps) {
    const p = levelPuzzle(n)
    assert.ok(p.wrap)
    const usesWrap = p.path.some(([r, c], i) => i && Math.abs(r - p.path[i - 1][0]) + Math.abs(c - p.path[i - 1][1]) > 1)
    assert.ok(usesWrap, `level ${n} never wraps`)
  }
})
