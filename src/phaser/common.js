import { KINDS } from '../game.js'

export const W = 640
export const H = 860
export const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
export const TEX = 96

const ENDS = { 1: [48, 0], 2: [96, 48], 4: [48, 96], 8: [0, 48] }

function canvas(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return
  const t = scene.textures.createCanvas(key, w, h)
  draw(t.getContext(), w, h)
  t.refresh()
}

function arms(ctx, mask, width, color, round = true) {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'butt'
  for (const bit of [1, 2, 4, 8]) {
    if (!(mask & bit)) continue
    ctx.beginPath()
    ctx.moveTo(48, 48)
    ctx.lineTo(...ENDS[bit])
    ctx.stroke()
  }
  if (round) {
    ctx.beginPath()
    ctx.arc(48, 48, width / 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function makeTextures(scene) {
  for (const [kind, mask] of Object.entries(KINDS)) {
    canvas(scene, `pipe_${kind}`, TEX, TEX, (ctx) => {
      arms(ctx, mask, 42, '#0f172a')
      arms(ctx, mask, 36, '#94a3b8')
      arms(ctx, mask, 30, '#cbd5e1')
      arms(ctx, mask, 20, '#0b1220')
      if (kind === 'cap') {
        ctx.fillStyle = '#94a3b8'
        ctx.beginPath()
        ctx.arc(48, 48, 22, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#0f172a'
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.fillStyle = '#0b1220'
        ctx.beginPath()
        ctx.arc(48, 48, 10, 0, Math.PI * 2)
        ctx.fill()
      }
    })
    canvas(scene, `water_${kind}`, TEX, TEX, (ctx) => {
      arms(ctx, mask, 20, '#0ea5e9')
      arms(ctx, mask, 12, '#38bdf8')
      arms(ctx, mask, 5, '#e0f2fe')
      if (kind === 'cap') {
        ctx.fillStyle = '#38bdf8'
        ctx.beginPath()
        ctx.arc(48, 48, 10, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  }

  canvas(scene, 'tile', TEX, TEX, (ctx) => {
    ctx.fillStyle = 'rgba(7, 24, 40, 0.85)'
    ctx.beginPath()
    ctx.roundRect(3, 3, 90, 90, 12)
    ctx.fill()
    ctx.strokeStyle = 'rgba(148, 197, 255, 0.16)'
    ctx.lineWidth = 2
    ctx.stroke()
  })
  canvas(scene, 'wall', TEX, TEX, (ctx) => {
    ctx.fillStyle = '#1f2937'
    ctx.beginPath()
    ctx.roundRect(3, 3, 90, 90, 12)
    ctx.fill()
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 3
    for (let y = 18; y < 90; y += 24) {
      ctx.beginPath()
      ctx.moveTo(8, y)
      ctx.lineTo(88, y)
      ctx.stroke()
    }
    for (let y = 0; y < 4; y++) {
      for (let x = y % 2 ? 24 : 40; x < 90; x += 32) {
        ctx.beginPath()
        ctx.moveTo(x, 6 + y * 24)
        ctx.lineTo(x, 18 + y * 24)
        ctx.stroke()
      }
    }
  })
  canvas(scene, 'bolt', 28, 28, (ctx) => {
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(14, 14, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(8, 14)
    ctx.lineTo(20, 14)
    ctx.moveTo(14, 8)
    ctx.lineTo(14, 20)
    ctx.stroke()
  })
  canvas(scene, 'spark', 16, 16, (ctx) => {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(8, 8, 8, 0, Math.PI * 2)
    ctx.fill()
  })
  canvas(scene, 'drop', 16, 24, (ctx) => {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(8, 0)
    ctx.quadraticCurveTo(16, 14, 8, 24)
    ctx.quadraticCurveTo(0, 14, 8, 0)
    ctx.fill()
  })
  canvas(scene, 'glow', 128, 128, (ctx) => {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 128, 128)
  })
}

export function background(scene, [c1, c2], tint = 0x7dd3fc) {
  const key = `bg${c1}${c2}`
  canvas(scene, key, 64, H, (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, c1)
    grad.addColorStop(1, c2)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 64, H)
  })
  scene.add.image(W / 2, H / 2, key).setDisplaySize(W, H).setDepth(-100)
  scene.add
    .particles(0, 0, 'spark', {
      x: { min: 0, max: W },
      y: H + 10,
      speedY: { min: -60, max: -20 },
      speedX: { min: -10, max: 10 },
      lifespan: 9000,
      scale: { start: 0.4, end: 0.1 },
      alpha: { start: 0.35, end: 0 },
      frequency: 240,
      tint,
    })
    .setDepth(-90)
}

export function button(scene, x, y, label, fn, { w = 200, h = 54, size = 22, color = 0x0284c7, textColor = '#fff' } = {}) {
  const box = scene.add.container(x, y)
  const bg = scene.add.graphics()
  const draw = (fill, alpha) => {
    bg.clear()
    bg.fillStyle(fill, alpha).fillRoundedRect(-w / 2, -h / 2, w, h, 14)
    bg.lineStyle(2, 0xffffff, 0.3).strokeRoundedRect(-w / 2, -h / 2, w, h, 14)
  }
  draw(color, 0.92)
  const t = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: textColor }).setOrigin(0.5)
  box.add([bg, t])
  box.setSize(w, h).setInteractive({ useHandCursor: true })
  box.on('pointerover', () => draw(color, 1))
  box.on('pointerout', () => draw(color, 0.92))
  box.on('pointerdown', () => {
    scene.tweens.add({ targets: box, scale: 0.94, duration: 70, yoyo: true })
    fn()
  })
  box.setLabel = (s) => t.setText(s)
  return box
}

export const text = (scene, x, y, str, size = 22, color = '#fff', extra = {}) =>
  scene.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, ...extra })

export function fade(scene, to, data) {
  scene.input.enabled = false
  scene.cameras.main.fadeOut(220, 4, 20, 36)
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(to, data))
}

