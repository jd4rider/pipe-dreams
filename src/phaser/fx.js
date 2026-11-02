export function debris(scene, x, y, color, big = false) {
  const e = scene.add
    .particles(x, y, 'shard', {
      speed: { min: 120, max: big ? 520 : 380 },
      angle: { min: 0, max: 360 },
      gravityY: 700,
      rotate: { min: 0, max: 360 },
      scale: { start: big ? 1.1 : 0.8, end: 0 },
      lifespan: { min: 450, max: 900 },
      tint: color,
      emitting: false,
    })
    .setDepth(15)
  e.explode(big ? 18 : 9)
  const glow = scene.add
    .particles(x, y, 'spark', {
      speed: { min: 40, max: 300 },
      scale: { start: 0.7, end: 0 },
      lifespan: 500,
      tint: 0xffffff,
      blendMode: 'ADD',
      emitting: false,
    })
    .setDepth(16)
  glow.explode(big ? 14 : 6)
  scene.time.delayedCall(1100, () => {
    e.destroy()
    glow.destroy()
  })
}

export function ring(scene, x, y, color, radius, duration = 450, width = 6) {
  const c = scene.add.circle(x, y, 10).setStrokeStyle(width, color).setDepth(17)
  scene.tweens.add({
    targets: c,
    scale: radius / 10,
    alpha: 0,
    duration,
    ease: 'Cubic.Out',
    onComplete: () => c.destroy(),
  })
}

export function flashAt(scene, x, y, size, color = 0xffffff) {
  const g = scene.add.image(x, y, 'glow').setTint(color).setBlendMode('ADD').setDepth(16).setScale(0.3)
  scene.tweens.add({ targets: g, scale: size / 128, alpha: 0, duration: 420, ease: 'Quad.Out', onComplete: () => g.destroy() })
}

export function beam(scene, { x, y, w, h }, color) {
  const r = scene.add.rectangle(x, y, w, h, 0xffffff, 0.95).setDepth(17).setBlendMode('ADD')
  const r2 = scene.add.rectangle(x, y, w, h, color, 0.5).setDepth(16).setBlendMode('ADD')
  const horiz = w > h
  scene.tweens.add({ targets: r, [horiz ? 'scaleY' : 'scaleX']: 0.1, alpha: 0, duration: 450, ease: 'Quad.Out', onComplete: () => r.destroy() })
  scene.tweens.add({ targets: r2, [horiz ? 'scaleY' : 'scaleX']: 2.4, alpha: 0, duration: 520, ease: 'Quad.Out', onComplete: () => r2.destroy() })
}

export function bolt(scene, x1, y1, x2, y2, color) {
  const g = scene.add.graphics().setDepth(17).setBlendMode('ADD')
  const pts = [[x1, y1]]
  const n = 5
  for (let i = 1; i < n; i++) {
    const t = i / n
    pts.push([x1 + (x2 - x1) * t + (Math.random() - 0.5) * 36, y1 + (y2 - y1) * t + (Math.random() - 0.5) * 36])
  }
  pts.push([x2, y2])
  g.lineStyle(7, color, 0.5).strokePoints(pts.map(([x, y]) => ({ x, y })), false)
  g.lineStyle(3, 0xffffff, 1).strokePoints(pts.map(([x, y]) => ({ x, y })), false)
  scene.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() })
}

export function popText(scene, x, y, str, color = '#fff', size = 26) {
  const t = scene.add
    .text(x, y, str, { fontFamily: 'system-ui, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#000', strokeThickness: 5 })
    .setOrigin(0.5)
    .setDepth(25)
    .setScale(0.5)
  scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.Out' })
  scene.tweens.add({ targets: t, y: y - 50, alpha: 0, delay: 350, duration: 550, onComplete: () => t.destroy() })
}

export function droplets(scene, x, y, count = 8, speed = 260, up = false) {
  const e = scene.add
    .particles(x, y, 'drop', {
      speed: { min: speed * 0.3, max: speed },
      angle: up ? { min: 245, max: 295 } : { min: 0, max: 360 },
      gravityY: 800,
      scale: { start: 0.9, end: 0.2 },
      lifespan: { min: 500, max: 900 },
      tint: [0x7dd3fc, 0x38bdf8, 0xe0f2fe],
      emitting: false,
    })
    .setDepth(18)
  e.explode(count)
  scene.time.delayedCall(1000, () => e.destroy())
}
