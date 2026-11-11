import Phaser from 'phaser'
import { openTipJar } from './support.js'
import { W, H, background, button, text, fade } from './common.js'
import { ring, flashAt, popText, droplets } from './fx.js'
import { audioState, sfx } from '../sound.js'
import { data, persist } from './save.js'
import { flood, isSolved, maskOf, turn, hintTile, starsFor, generate, rushSpec, levelPuzzle, TOTAL_LEVELS, WORLDS, LEVELS_PER_WORLD } from '../game.js'

const BOARD_TOP = 140
const BOARD_H = 640
const RUSH_TIME = 90
const worldOf = (level) => Math.min(WORLDS.length - 1, Math.floor((level - 1) / LEVELS_PER_WORLD))

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('game')
  }

  init(cfg = {}) {
    this.mode = cfg.mode ?? 'puzzle'
    this.level = cfg.level ?? 1
    this.worldIndex = this.mode === 'puzzle' ? worldOf(this.level) : 1
    this.rushSolved = 0
    this.rushSeed = Math.floor(Math.random() * 1e9)
    this.busy = true
    this.phase = 'intro'
    this.cells = []
    this.panel = null
    this.hintRing = null
  }

  create() {
    const world = WORLDS[this.worldIndex]
    this.world = world
    background(this, world.bg)
    this.cameras.main.fadeIn(250, 4, 20, 36)

    // Opaque header keeps pop-ins and splashes tidy.
    this.add.rectangle(W / 2, 62, W, 124, 0x03121f, 0.92).setDepth(30)
    this.add.rectangle(W / 2, 124, W, 3, world.color, 0.9).setDepth(31)
    this.titleText = text(this, 24, 22, '', 30, '#fff', { fontStyle: 'bold' }).setDepth(32)
    this.subText = text(this, 24, 66, '', 18, '#7dd3fc').setDepth(32)
    this.mainText = text(this, W / 2 + 20, 56, '', 54, '#fde68a', { fontStyle: 'bold' }).setOrigin(0.5).setDepth(32)
    this.rightText = text(this, W - 24, 36, '', 20, '#bae6fd', { align: 'right' }).setOrigin(1, 0.5).setDepth(32)
    this.rightText2 = text(this, W - 24, 70, '', 20, '#bae6fd', { align: 'right' }).setOrigin(1, 0.5).setDepth(32)

    const y = 822
    const opts = { w: 140, h: 46, size: 18 }
    button(this, 95, y, '💡 Hint', () => this.hint(), { ...opts, color: 0xb45309 }).setDepth(32)
    button(this, 245, y, '↺ Reset', () => this.reset(), { ...opts, color: 0x0369a1 }).setDepth(32)
    this.soundBtn = button(this, 395, y, audioState.muted ? 'Sound off' : 'Sound on', () => {
      audioState.muted = !audioState.muted
      data.muted = audioState.muted
      persist()
      this.soundBtn.setLabel(audioState.muted ? 'Sound off' : 'Sound on')
    }, { ...opts, color: 0x374151 }).setDepth(32)
    button(this, 545, y, this.mode === 'puzzle' ? 'Levels' : 'Menu', () => this.leave(), { ...opts, color: 0x374151 }).setDepth(32)

    this.time.addEvent({ delay: 180, loop: true, callback: () => this.ambient() })
    this.toast = text(this, W / 2, 400, '', 38, '#fde68a', { fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(50).setAlpha(0)

    if (this.mode === 'rush') {
      this.timeLeft = RUSH_TIME
      this.timer = this.time.addEvent({ delay: 100, loop: true, callback: () => this.tick() })
    }
    this.begin(false)
  }

  // ---------- level lifecycle ----------

  async begin(withWipe) {
    this.busy = true
    this.phase = 'intro'
    if (withWipe) await this.wipe(true)
    this.puzzle = this.mode === 'puzzle' ? levelPuzzle(this.level) : generate(rushSpec(this.rushSolved, this.rushSeed + this.rushSolved * 31))
    this.initialRots = this.puzzle.tiles.map((row) => row.map((t) => t.rot))
    this.moves = 0
    this.panel?.destroy()
    this.panel = null
    this.clearHint()
    this.buildBoard()
    this.refreshHud()
    if (withWipe) await this.wipe(false)
    if (this.mode === 'puzzle') await this.intro()
    await this.popIn()
    this.phase = 'play'
    this.busy = false
    this.refreshWater()
  }

  buildBoard() {
    this.layer?.destroy()
    const p = this.puzzle
    const cell = Math.min(Math.floor(600 / p.cols), Math.floor(BOARD_H / p.rows), 104)
    const bw = cell * p.cols
    const bh = cell * p.rows
    const ox = (W - bw) / 2
    const oy = BOARD_TOP + (BOARD_H - bh) / 2
    this.cell = cell
    this.ox = ox
    this.oy = oy
    const layer = this.add.container(0, 0).setDepth(5)
    this.layer = layer
    const panel = this.add.graphics()
    panel.fillStyle(0x020a12, 0.7).fillRoundedRect(ox - 12, oy - 12, bw + 24, bh + 24, 22)
    panel.lineStyle(3, this.world.color, 0.6).strokeRoundedRect(ox - 12, oy - 12, bw + 24, bh + 24, 22)
    layer.add(panel)

    this.portals = []
    if (p.wrap) {
      const slots = []
      for (let r = 0; r < p.rows; r++) {
        slots.push([r, 0, 8, ox - 7, oy + r * cell + cell / 2, 'v'], [r, p.cols - 1, 2, ox + bw + 7, oy + r * cell + cell / 2, 'v'])
      }
      for (let c = 0; c < p.cols; c++) {
        slots.push([0, c, 1, ox + c * cell + cell / 2, oy - 7, 'h'], [p.rows - 1, c, 4, ox + c * cell + cell / 2, oy + bh + 7, 'h'])
      }
      slots.forEach(([r, c, bit, x, y, o], i) => {
        const glow = this.add.image(x, y, 'glow').setTint(0xc084fc).setBlendMode('ADD').setScale(0.5).setAlpha(0.3)
        const bar = this.add.rectangle(x, y, o === 'v' ? 8 : cell * 0.5, o === 'v' ? cell * 0.5 : 8, 0xe9d5ff, 0.9).setAlpha(0.35)
        layer.add([glow, bar])
        this.tweens.add({ targets: glow, scale: 0.75, duration: 900, yoyo: true, repeat: -1, delay: i * 70, ease: 'Sine.InOut' })
        this.portals.push({ r, c, bit, glow, bar, lit: false })
      })
      const edge = this.add.graphics()
      edge.lineStyle(3, 0xc084fc, 0.9).strokeRoundedRect(ox - 12, oy - 12, bw + 24, bh + 24, 22)
      layer.add(edge)
    }

    const k = cell / 96
    this.cells = p.tiles.map((row, r) =>
      row.map((t, c) => {
        const cont = this.add.container(ox + c * cell + cell / 2, oy + r * cell + cell / 2).setScale(0)
        cont.add(this.add.image(0, 0, t.role === 'wall' ? 'wall' : 'tile'))
        const e = { cont, k, angle: t.rot * 90, wet: false, water: null, spin: null }
        if (t.kind) {
          const pipe = this.add.image(0, 0, `pipe_${t.kind}`)
          const water = this.add.image(0, 0, `water_${t.kind}`).setAlpha(0)
          const spin = this.add.container(0, 0, [pipe, water]).setAngle(e.angle)
          cont.add(spin)
          e.spin = spin
          e.water = water
          if (t.role === 'source' || t.role === 'drain') {
            const src = t.role === 'source'
            cont.add(this.add.circle(0, 0, 21, src ? 0x16a34a : 0xea580c).setStrokeStyle(3, 0xffffff, 0.9))
            cont.add(text(this, 0, 0, src ? 'IN' : 'OUT', src ? 20 : 17, '#fff', { fontStyle: 'bold' }).setOrigin(0.5))
          } else if (t.fixed) {
            cont.add(this.add.image(0, 0, 'bolt').setScale(0.8))
          }
        }
        cont.setSize(96, 96).setInteractive({ useHandCursor: !!t.kind && !t.fixed })
        cont.on('pointerdown', () => this.tap(r, c))
        layer.add(cont)
        return e
      }),
    )
  }

  async popIn() {
    const jobs = []
    this.cells.forEach((row, r) =>
      row.forEach((e, c) => jobs.push(this.tween({ targets: e.cont, scale: e.k, duration: 260, delay: (r + c) * 28, ease: 'Back.Out' }))),
    )
    sfx.whoosh()
    await Promise.all(jobs)
  }

  async intro() {
    const label = `Level ${this.level}`
    const sub = this.puzzle.wrap ? 'Purple edges are portals: water leaves one side and re-enters the other!' : this.puzzle.par ? 'Turn the pipes so the water flows from IN to OUT' : ''
    sfx.whoosh()
    const cy = BOARD_TOP + BOARD_H / 2
    const band = this.add.rectangle(W / 2, cy, W, 170, 0x000000, 0.75).setDepth(40).setScale(1, 0)
    const l1 = this.add.rectangle(W / 2, cy - 85, W, 4, this.world.color).setDepth(41).setScale(0, 1)
    const l2 = this.add.rectangle(W / 2, cy + 85, W, 4, this.world.color).setDepth(41).setScale(0, 1)
    const t1 = text(this, -300, cy - 26, label, 64, '#fff', { fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(42)
    const t2 = text(this, W + 400, cy + 36, sub, 21, '#7dd3fc', { align: 'center', wordWrap: { width: 540 } }).setOrigin(0.5).setDepth(42)
    await Promise.all([
      this.tween({ targets: band, scaleY: 1, duration: 220, ease: 'Back.Out' }),
      this.tween({ targets: [l1, l2], scaleX: 1, duration: 300 }),
      this.tween({ targets: t1, x: W / 2, duration: 420, ease: 'Back.Out' }),
      this.tween({ targets: t2, x: W / 2, duration: 520, ease: 'Cubic.Out' }),
    ])
    await this.delay(850)
    await Promise.all([
      this.tween({ targets: t1, x: W + 400, duration: 300, ease: 'Cubic.In' }),
      this.tween({ targets: t2, x: -400, duration: 300, ease: 'Cubic.In' }),
      this.tween({ targets: band, scaleY: 0, duration: 260, delay: 120 }),
      this.tween({ targets: [l1, l2], scaleX: 0, duration: 260, delay: 120 }),
    ])
    ;[band, l1, l2, t1, t2].forEach((o) => o.destroy())
  }

  // A rising wave of water covers the screen between levels.
  async wipe(closing) {
    if (closing) {
      sfx.whoosh()
      const wave = this.add.container(0, H + 60).setDepth(60)
      wave.add(this.add.rectangle(0, 0, W, H + 200, 0x0284c7).setOrigin(0, 0))
      for (let i = 0; i < 14; i++) {
        wave.add(this.add.circle(i * (W / 13), Phaser.Math.Between(-4, 6), Phaser.Math.Between(22, 36), 0x0284c7))
        wave.add(this.add.circle(i * (W / 13) + 20, Phaser.Math.Between(-16, -4), Phaser.Math.Between(8, 16), 0x7dd3fc, 0.9))
      }
      wave.add(this.add.rectangle(0, 120, W, 40, 0x0369a1, 0.6).setOrigin(0, 0))
      this.wave = wave
      await this.tween({ targets: wave, y: -40, duration: 520, ease: 'Cubic.InOut' })
    } else {
      sfx.whoosh()
      await this.tween({ targets: this.wave, y: -H - 260, duration: 560, ease: 'Cubic.InOut' })
      this.wave.destroy()
      this.wave = null
    }
  }

  // ---------- helpers ----------

  tween(config) {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: resolve }))
  }

  delay(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve))
  }

  say(msg, color = '#fde68a') {
    this.tweens.killTweensOf(this.toast)
    this.toast.setText(msg).setColor(color).setAlpha(1).setScale(0.6).setY(BOARD_TOP + 300)
    this.tweens.add({ targets: this.toast, scale: 1.1, duration: 150, yoyo: true })
    this.tweens.add({ targets: this.toast, y: BOARD_TOP + 240, alpha: 0, delay: 700, duration: 600 })
  }

  centre(r, c) {
    return [this.ox + c * this.cell + this.cell / 2, this.oy + r * this.cell + this.cell / 2]
  }

  refreshHud() {
    if (this.mode === 'puzzle') {
      this.titleText.setText(`Level ${this.level}`)
      this.subText.setText(this.world.name)
      this.mainText.setText(`${this.moves}`)
      this.rightText.setText(`Par ${this.puzzle?.par ?? 0}`).setY(52)
      this.rightText2.setText('')
    } else {
      this.titleText.setText('Rush')
      this.subText.setText(`Best ${data.bestRush}`)
      this.mainText.setText(`${Math.ceil(this.timeLeft)}s`)
      this.rightText.setText(`Solved ${this.rushSolved}`)
      this.rightText2.setText(this.puzzle ? `${this.puzzle.rows}×${this.puzzle.cols}` : '')
    }
  }

  // ---------- play ----------

  tap(r, c) {
    if (this.busy || this.phase !== 'play') return
    const t = this.puzzle.tiles[r][c]
    const e = this.cells[r][c]
    if (!t.kind || t.fixed) {
      if (t.kind) {
        sfx.locked()
        this.tweens.add({ targets: e.cont, x: e.cont.x + 5, duration: 45, yoyo: true, repeat: 2 })
      }
      return
    }
    turn(t)
    this.moves++
    sfx.rotate()
    this.clearHint()
    e.angle += 90
    this.tweens.killTweensOf(e.spin)
    this.tweens.add({ targets: e.spin, angle: e.angle, duration: 160, ease: 'Back.Out' })
    this.refreshHud()
    if (isSolved(this.puzzle)) {
      this.win()
    } else {
      this.time.delayedCall(140, () => this.phase === 'play' && this.refreshWater())
    }
  }

  refreshWater(slow = false) {
    const p = this.puzzle
    const dist = flood(p)
    this.cells.forEach((row, r) =>
      row.forEach((e, c) => {
        if (!e.water) return
        const d = dist.get(r * p.cols + c)
        const wet = d !== undefined
        if (wet && !e.wet) {
          e.wet = true
          const delay = d * (slow ? 90 : 35)
          this.tweens.killTweensOf(e.water)
          this.tweens.add({
            targets: e.water,
            alpha: 1,
            duration: 260,
            delay,
            onComplete: () => {
              if (!e.wet) return
              this.tweens.add({ targets: e.water, alpha: 0.72, duration: 700 + ((r * 7 + c * 13) % 5) * 120, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
            },
          })
          this.time.delayedCall(delay, () => {
            if (!e.wet || !e.cont.active) return
            const [x, y] = this.centre(r, c)
            flashAt(this, x, y, this.cell * 1.3, 0x7dd3fc)
            droplets(this, x, y, 4, 150)
            this.tweens.add({ targets: e.cont, scale: e.k * 1.1, duration: 110, yoyo: true })
          })
        } else if (!wet && e.wet) {
          e.wet = false
          this.tweens.killTweensOf(e.water)
          this.tweens.add({ targets: e.water, alpha: 0, duration: 180 })
        }
      }),
    )
    this.portals?.forEach((pt) => {
      const open = !!(maskOf(p.tiles[pt.r][pt.c]) & pt.bit) && dist.has(pt.r * p.cols + pt.c)
      if (open !== pt.lit) {
        pt.lit = open
        this.tweens.add({ targets: [pt.glow, pt.bar], alpha: open ? 1 : 0.35, duration: 200 })
        if (open) {
          const x = pt.glow.x
          const y = pt.glow.y
          ring(this, x, y, 0xc084fc, 70, 600, 4)
          droplets(this, x, y, 8, 200)
        }
      }
    })
    return dist
  }

  // Bubbles and sparkles drifting up from flowing pipes.
  ambient() {
    if (this.phase !== 'play' && this.phase !== 'won') return
    const wet = []
    this.cells?.forEach((row, r) => row.forEach((e, c) => e.wet && e.cont.active && wet.push([r, c])))
    for (let i = 0; i < Math.min(3, wet.length); i++) {
      const [r, c] = wet[Math.floor(Math.random() * wet.length)]
      const [x, y] = this.centre(r, c)
      const px = x + (Math.random() - 0.5) * this.cell * 0.5
      const py = y + (Math.random() - 0.5) * this.cell * 0.4
      const b = this.add.circle(px, py, 2 + Math.random() * 3, 0xe0f2fe, 0.85).setDepth(14).setBlendMode('ADD')
      this.tweens.add({ targets: b, y: py - 26 - Math.random() * 20, x: px + (Math.random() - 0.5) * 14, alpha: 0, scale: 0.4, duration: 800 + Math.random() * 500, onComplete: () => b.destroy() })
    }
  }

  hint() {
    if (this.busy || this.phase !== 'play') return
    const h = hintTile(this.puzzle)
    if (!h) return
    sfx.hint()
    this.clearHint()
    const [x, y] = this.centre(...h)
    const ringObj = this.add.rectangle(x, y, this.cell - 4, this.cell - 4).setStrokeStyle(5, 0xfde047).setDepth(20)
    this.hintRing = ringObj
    this.tweens.add({ targets: ringObj, alpha: 0.2, scale: 1.12, duration: 380, yoyo: true, repeat: 4, onComplete: () => this.clearHint() })
  }

  clearHint() {
    if (this.hintRing) {
      this.tweens.killTweensOf(this.hintRing)
      this.hintRing.destroy()
      this.hintRing = null
    }
  }

  reset() {
    if (this.busy || this.phase !== 'play') return
    this.puzzle.tiles.forEach((row, r) =>
      row.forEach((t, c) => {
        const e = this.cells[r][c]
        if (!e.spin || t.fixed) return
        t.rot = this.initialRots[r][c]
        e.angle = Math.ceil(e.angle / 360) * 360 + t.rot * 90
        this.tweens.killTweensOf(e.spin)
        this.tweens.add({ targets: e.spin, angle: e.angle, duration: 320, ease: 'Cubic.InOut' })
      }),
    )
    this.moves = 0
    sfx.whoosh()
    this.clearHint()
    this.refreshHud()
    this.time.delayedCall(340, () => this.refreshWater())
  }

  tick() {
    if (this.phase !== 'play') return
    this.timeLeft = Math.max(0, this.timeLeft - 0.1)
    this.refreshHud()
    if (this.timeLeft <= 0) this.finishRush()
  }

  // ---------- endings ----------

  async win() {
    this.busy = true
    this.phase = 'won'
    this.clearHint()
    const p = this.puzzle
    await this.delay(170)
    const dist = this.refreshWater(true)
    let maxD = 0
    dist.forEach((d, key) => {
      maxD = Math.max(maxD, d)
      const r = Math.floor(key / p.cols)
      const c = key % p.cols
      this.time.delayedCall(d * 90 + 120, () => {
        if (!this.cells[r]?.[c]?.cont?.active) return
        if (d % 2 === 0) sfx.flow(d)
        const [x, y] = this.centre(r, c)
        droplets(this, x, y, 5, 180)
        ring(this, x, y, 0x7dd3fc, this.cell * 0.9, 500, 3)
        flashAt(this, x, y, this.cell * 1.6, 0xe0f2fe)
      })
    })
    await this.delay(maxD * 90 + 500)
    const [dx, dy] = this.centre(...p.drain)
    sfx.splash()
    droplets(this, dx, dy, 44, 620, true)
    ring(this, dx, dy, 0x7dd3fc, 260, 800, 8)
    ring(this, dx, dy, 0xffffff, 380, 1000, 4)
    ring(this, dx, dy, 0x38bdf8, 520, 1200, 3)
    for (let i = 0; i < 6; i++) this.time.delayedCall(i * 90, () => droplets(this, dx + Phaser.Math.Between(-30, 30), dy, 14, 560, true))
    flashAt(this, dx, dy, 360, 0x7dd3fc)
    this.cameras.main.shake(180, 0.006)

    if (this.mode === 'rush') {
      this.rushSolved++
      const bonus = 6 + Math.min(6, p.rows - 4)
      this.timeLeft = Math.min(RUSH_TIME + 30, this.timeLeft + bonus)
      popText(this, W / 2, 400, `+${bonus}s`, '#86efac', 46)
      sfx.coin()
      await this.delay(700)
      if (this.phase !== 'won') return
      this.begin(false)
      return
    }

    sfx.win()
    this.say('FLOWING!', '#7dd3fc')
    await this.delay(900)
    const stars = starsFor(this.moves, p.par)
    const prev = data.stars[this.level] || 0
    data.stars[this.level] = Math.max(prev, stars)
    data.unlocked = Math.min(TOTAL_LEVELS, Math.max(data.unlocked, this.level + 1))
    persist()
    this.showPanel({ won: true, title: `Level ${this.level} Complete!`, stars, lines: [`${this.moves} moves · par ${p.par}`] })
  }

  finishRush() {
    if (this.phase === 'over') return
    this.phase = 'over'
    this.busy = true
    this.clearHint()
    sfx.lose()
    const record = this.rushSolved > data.bestRush
    if (record) {
      data.bestRush = this.rushSolved
      persist()
    }
    this.showPanel({
      won: false,
      title: "Time's up!",
      lines: [`Puzzles solved: ${this.rushSolved}`, record ? '🏆 New best!' : `Best ${data.bestRush}`],
    })
  }

  leave() {
    fade(this, this.mode === 'puzzle' ? 'levels' : 'menu', { world: this.worldIndex })
  }

  showPanel({ won, title, stars, lines = [] }) {
    const p = this.add.container(0, 0).setDepth(70)
    this.panel = p
    p.add(this.add.rectangle(W / 2, H / 2, W, H, 0x020a12, 0.8).setInteractive())
    const card = this.add.graphics()
    card.fillStyle(0x08243a, 1).fillRoundedRect(60, 170, W - 120, 540, 24)
    card.lineStyle(3, won ? 0x7dd3fc : 0xfb7185, 0.9).strokeRoundedRect(60, 170, W - 120, 540, 24)
    p.add(card)
    p.add(text(this, W / 2, 225, title, 36, won ? '#7dd3fc' : '#fda4af', { fontStyle: 'bold' }).setOrigin(0.5))
    if (stars) {
      for (let i = 0; i < 3; i++) {
        const s = text(this, W / 2 + (i - 1) * 90, 330, '★', 84, i < stars ? '#fde047' : '#1e3a5f').setOrigin(0.5).setScale(0)
        p.add(s)
        this.tweens.add({ targets: s, scale: 1, duration: 400, delay: 300 + i * 260, ease: 'Back.Out', onStart: () => i < stars && sfx.coin() })
      }
    }
    p.add(text(this, W / 2, stars ? 405 : 320, lines.join('\n'), 26, '#bae6fd', { align: 'center', lineSpacing: 10 }).setOrigin(0.5, 0))

    const add = (label, y, fn, color) => p.add(button(this, W / 2, y, label, fn, { w: 280, h: 52, color }))
    if (this.mode === 'puzzle') {
      const more = won && this.level < TOTAL_LEVELS
      if (more) add('Next level ▶', 470, () => this.next(), 0x0284c7)
      add('Replay', more ? 530 : 500, () => this.begin(true), 0x075985)
      add('Levels', more ? 590 : 560, () => this.leave(), 0x374151)
    } else {
      add('Play again', 500, () => fade(this, 'game', { mode: 'rush' }), 0x0284c7)
      add('Menu', 560, () => this.leave(), 0x374151)
    }
    // Quiet support link: results panel only, under the actions inside the card.
    p.add(
      button(this, W / 2, 674, '☕ Buy me a coffee', () => openTipJar(), {
        w: 280,
        h: 44,
        size: 17,
        color: 0x0a2f4a,
        textColor: '#bae6fd',
      }),
    )
    p.setAlpha(0)
    this.tweens.add({ targets: p, alpha: 1, duration: 300 })
  }

  next() {
    const level = this.level + 1
    if (worldOf(level) !== this.worldIndex) {
      fade(this, 'game', { mode: 'puzzle', level })
    } else {
      this.level = level
      this.begin(true)
    }
  }
}
