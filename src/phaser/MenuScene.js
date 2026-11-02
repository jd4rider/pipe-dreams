import Phaser from 'phaser'
import { W, H, background, button, text, fade } from './common.js'
import { data } from './save.js'
import { TOTAL_LEVELS, WORLDS } from '../game.js'

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu')
  }

  create() {
    background(this, ['#0c3a5c', '#04121f'])
    this.cameras.main.fadeIn(300, 4, 20, 36)

    // A little pipe line that keeps turning, with water running through it.
    const kinds = ['elbow', 'straight', 'tee', 'elbow', 'cross', 'straight', 'elbow']
    const size = 80
    kinds.forEach((kind, i) => {
      const x = W / 2 + (i - 3) * size
      this.add.image(x, 130, 'tile').setScale(size / 96)
      const spin = this.add.container(x, 130, [this.add.image(0, 0, `pipe_${kind}`), this.add.image(0, 0, `water_${kind}`)]).setScale(size / 96)
      spin.angle = (i % 4) * 90
      this.tweens.add({ targets: spin, angle: '+=90', duration: 400, delay: 800 + i * 350, repeat: -1, repeatDelay: 2400, ease: 'Back.Out' })
    })

    const title = text(this, W / 2, 265, 'Pipe Dreams', 76, '#7dd3fc', { fontStyle: 'bold', stroke: '#03121f', strokeThickness: 8 }).setOrigin(0.5)
    this.tweens.add({ targets: title, scale: 1.04, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    text(this, W / 2, 330, 'Turn the pipes. Guide the water.', 22, '#bae6fd').setOrigin(0.5)

    const stars = Object.values(data.stars).reduce((a, b) => a + b, 0)
    const done = Object.keys(data.stars).length
    button(this, W / 2, 440, '🔧  Puzzle', () => this.puzzle(), { w: 400, h: 62, size: 28, color: 0x0284c7 })
    text(this, W / 2, 486, `${done}/${TOTAL_LEVELS} levels · ${stars}★`, 16, '#7dd3fc').setOrigin(0.5)
    button(this, W / 2, 560, '⏱  Rush', () => fade(this, 'game', { mode: 'rush' }), { w: 400, h: 62, size: 28, color: 0xdb2777 })
    text(this, W / 2, 606, data.bestRush ? `Best ${data.bestRush} puzzles in 90s` : '90 seconds — solve as many as you can', 16, '#f9a8d4').setOrigin(0.5)

    WORLDS.forEach((w, i) => this.add.circle(W / 2 + (i - 2) * 34, 690, 10, w.color))
    text(this, W / 2, 725, 'Tap a pipe to turn it · connect IN to OUT', 17, '#7dd3fc').setOrigin(0.5)
    text(this, W / 2, H - 40, '🔒 pipes with a bolt are fixed in place', 15, '#64748b').setOrigin(0.5)
  }

  puzzle() {
    fade(this, 'levels', { world: Math.floor((Math.min(data.unlocked, TOTAL_LEVELS) - 1) / 12) })
  }
}
