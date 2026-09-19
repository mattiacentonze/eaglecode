import { OptimizedBuffer, RGBA, TextAttributes } from "@opentui/core"
import { logo } from "../logo"

export type Rgb = [number, number, number]

export function toRgb(color: RGBA): Rgb {
  const [r, g, b] = color.toInts()
  return [r, g, b]
}

function clamp(n: number) {
  return Math.max(0, Math.min(1, n))
}

function writeRgb(buffer: Uint8Array | Uint16Array, offset: number, r: number, g: number, b: number, a = 255) {
  buffer[offset] = r
  buffer[offset + 1] = g
  buffer[offset + 2] = b
  buffer[offset + 3] = a
}

function mixChannel(base: number, overlay: number, alpha: number) {
  return Math.round(base + (overlay - base) * clamp(alpha))
}

function mixRgb(base: Rgb, overlay: Rgb, alpha: number): Rgb {
  const a = clamp(alpha)
  return [mixChannel(base[0], overlay[0], a), mixChannel(base[1], overlay[1], a), mixChannel(base[2], overlay[2], a)]
}

function sameRgb(a: Rgb, b: Rgb) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

// Flying raptor frames (typographic / data-art style)
// Articulated wings: Frame 0 (wings UP), Frame 1 (wings GLIDE/MID), Frame 2 (wings DOWN), Frame 3 (wings RECOVERY)
// Body and head remain stable while wings pivot organically around the torso
const EAGLE_RIGHT_FRAME_0 = [
  "      ╭╱~%8414^ ",
  "   ~1% ╲~%██8▄╮ ",
  "        ╰%██ ╰▄ ",
  "                ",
]

const EAGLE_RIGHT_FRAME_1 = [
  "    ╭~%84148%~╮ ",
  "   ~1% ╲~%██8▄╮ ",
  "       ╱~%██ ╰▄ ",
  "    ╰~%84148%~╯ ",
]

const EAGLE_RIGHT_FRAME_2 = [
  "         .▄8█▄. ",
  "   ~1% ╱~%██8▄╮ ",
  "   ╰~%84148%~╰▄ ",
  "  ╰╯    ╰~%8╯   ",
]

const EAGLE_RIGHT_FRAME_3 = [
  "       ╱~%84╲   ",
  "   ~1%  ╲%██8▄╮ ",
  "       ╱%███ ╰▄ ",
  "       ╰~%84╱   ",
]

const EAGLE_RIGHT_FRAMES = [
  EAGLE_RIGHT_FRAME_0,
  EAGLE_RIGHT_FRAME_1,
  EAGLE_RIGHT_FRAME_2,
  EAGLE_RIGHT_FRAME_3,
]

// Left-facing frames for the return arc / landing swoop towards columns 0-14
const EAGLE_LEFT_FRAME_0 = [
  " ^4148%~╲╮      ",
  " ╭▄8██%~╱ %1~   ",
  " ▄╯ ██%╯        ",
  "                ",
]

const EAGLE_LEFT_FRAME_1 = [
  " ╭~%84148%~╮    ",
  " ╭▄8██%~╱ %1~   ",
  " ▄╯ ██%~╲       ",
  " ╰~%84148%~╯    ",
]

const EAGLE_LEFT_FRAME_2 = [
  " .▄█8▄.         ",
  " ╭▄8██%~╲ %1~   ",
  " ▄╯~%84148%~╯   ",
  "   ╰8%~╯    ╰╯  ",
]

const EAGLE_LEFT_FRAME_3 = [
  "   ╱48%~╲       ",
  " ╭▄8██%╱  %1~   ",
  " ▄╯ ███%╲       ",
  "   ╲48%~╯       ",
]

const EAGLE_LEFT_FRAMES = [
  EAGLE_LEFT_FRAME_0,
  EAGLE_LEFT_FRAME_1,
  EAGLE_LEFT_FRAME_2,
  EAGLE_LEFT_FRAME_3,
]

// Dissolving particles for Phase 4
const DISSOLVE_CHARS = ["0", "1", "4", "7", "8", "%", "*", "+", "~", "^", "<", ">"]

// Wordmark dimensions
const LOGO_LEFT_WIDTH = 15
const LOGO_GAP = 1
const WORDMARK_START_X = LOGO_LEFT_WIDTH + LOGO_GAP
const TOTAL_LOGO_WIDTH = WORDMARK_START_X + logo.right[0]!.length
const CANVAS_HEIGHT = 7
const LOGO_ROW_OFFSET = 2 // Logo rows sit at y = 2..5 in the 7-row canvas

const FLIGHT_DURATION = 1800
const TRANSFORM_DURATION = 800
const TOTAL_ANIMATION_MS = FLIGHT_DURATION + TRANSFORM_DURATION

// Beam sweep constants for settled state
const SWEEP_MS = 1200
const IDLE_MS = 2500
const BEAM_RADIUS = 3.5

export type EagleFlyRenderOptions = {
  deltaTime?: number
  rgb?: boolean
}

export class EagleFlyPainter {
  private panelRgb: Rgb = [15, 23, 42]
  private primaryRgb: Rgb = [0, 102, 220]
  private textRgb: Rgb = [255, 255, 255]
  private textMutedRgb: Rgb = [148, 163, 184]
  private iceBlueRgb: Rgb = [190, 215, 248]
  private elapsed = 0
  private animationEnabled = true
  private beamElapsed = 0

  setPanelBackground(value: RGBA | Rgb | undefined) {
    if (!value) return false
    const next = value instanceof RGBA ? toRgb(value) : value
    if (sameRgb(this.panelRgb, next)) return false
    this.panelRgb = next
    return true
  }

  setPrimary(value: RGBA | Rgb | undefined) {
    if (!value) return false
    const next = value instanceof RGBA ? toRgb(value) : value
    if (sameRgb(this.primaryRgb, next)) return false
    this.primaryRgb = next
    return true
  }

  setText(value: RGBA | Rgb | undefined) {
    if (!value) return false
    const next = value instanceof RGBA ? toRgb(value) : value
    if (sameRgb(this.textRgb, next)) return false
    this.textRgb = next
    return true
  }

  setTextMuted(value: RGBA | Rgb | undefined) {
    if (!value) return false
    const next = value instanceof RGBA ? toRgb(value) : value
    if (sameRgb(this.textMutedRgb, next)) return false
    this.textMutedRgb = next
    return true
  }

  setAnimationEnabled(enabled: boolean) {
    this.animationEnabled = enabled
  }

  isAnimationFinished(): boolean {
    return !this.animationEnabled || this.elapsed >= TOTAL_ANIMATION_MS
  }

  render(frameBuffer: OptimizedBuffer, options: EagleFlyRenderOptions = {}) {
    const rawDt = options.deltaTime ?? 0
    const dt = Math.max(0, Math.min(rawDt, 100))
    this.elapsed += dt

    const width = frameBuffer.width
    const height = frameBuffer.height
    const buffers = frameBuffer.buffers

    // Clear buffer with spaces and panel background
    const spaceCode = 32
    buffers.char.fill(spaceCode)
    buffers.attributes.fill(0)

    for (let i = 0; i < width * height; i++) {
      writeRgb(buffers.bg, i * 4, this.panelRgb[0], this.panelRgb[1], this.panelRgb[2], 255)
      writeRgb(buffers.fg, i * 4, this.textRgb[0], this.textRgb[1], this.textRgb[2], 255)
    }

    if (!this.animationEnabled || this.elapsed >= TOTAL_ANIMATION_MS) {
      // Fully settled state
      this.drawSettled(frameBuffer, dt)
      return
    }

    if (this.elapsed < FLIGHT_DURATION) {
      // Phase 1, 2, 3: Flight (wordmark is hidden during flight to prevent garbling)
      this.drawFlight(frameBuffer)
    } else {
      // Phase 4: Transform to head
      this.drawTransform(frameBuffer)
      // Wordmark smoothly illuminates as eagle perches and settles
      const transformElapsed = this.elapsed - FLIGHT_DURATION
      const wordmarkAlpha = clamp(transformElapsed / TRANSFORM_DURATION)
      this.drawWordmark(frameBuffer, false, null, wordmarkAlpha)
    }
  }

  private drawFlight(frameBuffer: OptimizedBuffer) {
    const progress = clamp(this.elapsed / FLIGHT_DURATION)

    // Smooth continuous flight path:
    // Stage 1 (progress 0.0 -> 0.55): Enter top-left, fly across above wordmark (rows 0-1)
    // Stage 2 (progress 0.55 -> 0.72): Smooth arc down on the right side, bank and turn left
    // Stage 3 (progress 0.72 -> 1.0): Swoop back left directly into perch at (x=0, y=LOGO_ROW_OFFSET=2)
    let eagleX = 0
    let eagleY = 0
    let facingRight = true

    if (progress < 0.55) {
      const p1 = progress / 0.55
      const s1 = Math.sin((p1 * Math.PI) / 2)
      eagleX = Math.round(-8 + s1 * 48)
      eagleY = Math.round(0 + s1 * 1)
      facingRight = true
    } else if (progress < 0.72) {
      const p2 = (progress - 0.55) / 0.17
      const arc = Math.sin(p2 * Math.PI)
      eagleX = Math.round(40 + arc * 3 - p2 * 10)
      eagleY = Math.round(1.0 + p2 * 1.0)
      facingRight = p2 < 0.5
    } else {
      const p3 = (progress - 0.72) / 0.28
      const s3 = Math.sin((p3 * Math.PI) / 2)
      eagleX = Math.round(30 * (1 - s3))
      eagleY = LOGO_ROW_OFFSET
      facingRight = false
    }

    // Wing flap cycling (4 articulated frames, ~160ms per frame)
    const flapCycleMs = 160
    const frameIndex = Math.floor(this.elapsed / flapCycleMs) % 4
    const frames = facingRight ? EAGLE_RIGHT_FRAMES : EAGLE_LEFT_FRAMES
    const frame = frames[frameIndex]!

    // Draw blue aura/vapor trail behind eagle
    this.drawFlightAura(frameBuffer, eagleX, eagleY)

    // Draw typographic eagle
    this.drawEagleSprite(frameBuffer, frame, eagleX, eagleY, 1.0)
  }

  private drawTransform(frameBuffer: OptimizedBuffer) {
    const transformElapsed = this.elapsed - FLIGHT_DURATION
    const progress = clamp(transformElapsed / TRANSFORM_DURATION)

    // Eagle is at logo position (x=0, y=LOGO_ROW_OFFSET)
    const eagleX = 0
    const eagleY = LOGO_ROW_OFFSET

    // Full eagle body/wings dissolve away, morphing into head facing left
    const frame = EAGLE_LEFT_FRAME_1
    const bodyAlpha = Math.max(0, 1 - progress * 1.5)

    if (bodyAlpha > 0) {
      this.drawEagleSprite(frameBuffer, frame, eagleX, eagleY, bodyAlpha)
    }

    // Dissolving particles streaming off wings & tail
    const particleCount = Math.floor((1 - progress) * 16)
    for (let p = 0; p < particleCount; p++) {
      const seed = (p * 37 + Math.floor(this.elapsed / 50)) % 100
      const px = eagleX + (seed % 14)
      const py = eagleY + ((seed * 7) % 3)
      if (px >= 0 && px < frameBuffer.width && py >= 0 && py < frameBuffer.height) {
        const char = DISSOLVE_CHARS[(p + seed) % DISSOLVE_CHARS.length]!
        const idx = py * frameBuffer.width + px
        frameBuffer.buffers.char[idx] = char.codePointAt(0)!
        const particleColor = mixRgb(this.iceBlueRgb, this.primaryRgb, 0.4)
        writeRgb(frameBuffer.buffers.fg, idx * 4, particleColor[0], particleColor[1], particleColor[2], 255)
      }
    }

    // Head facing left emerges and solidifies
    const headAlpha = clamp(progress * 1.6)
    this.drawEagleHead(frameBuffer, headAlpha, null)
  }

  private drawSettled(frameBuffer: OptimizedBuffer, dt: number) {
    // Update beam shimmer cycle
    const cycleTime = SWEEP_MS + IDLE_MS
    this.beamElapsed = (this.beamElapsed + dt) % cycleTime
    let beamCol: number | null = null
    if (this.beamElapsed < SWEEP_MS) {
      const progress = this.beamElapsed / SWEEP_MS
      beamCol = -3 + progress * 63
    }

    // Draw settled eagle head facing left next to wordmark
    this.drawEagleHead(frameBuffer, 1.0, beamCol)

    // Draw wordmark with shimmer
    this.drawWordmark(frameBuffer, true, beamCol, 1.0)
  }

  private drawFlightAura(frameBuffer: OptimizedBuffer, eagleX: number, eagleY: number) {
    const width = frameBuffer.width
    const height = frameBuffer.height
    const buffers = frameBuffer.buffers

    // Subtle cobalt blue glow on background behind eagle
    const auraLeft = Math.max(0, eagleX - 2)
    const auraRight = Math.min(width, eagleX + 16)
    const auraTop = Math.max(0, eagleY - 1)
    const auraBottom = Math.min(height, eagleY + 4)

    for (let y = auraTop; y < auraBottom; y++) {
      for (let x = auraLeft; x < auraRight; x++) {
        const idx = y * width + x
        const dist = Math.hypot(x - (eagleX + 7), (y - (eagleY + 1)) * 2)
        if (dist < 8) {
          const glow = Math.max(0, 1 - dist / 8) * 0.35
          const bgRgb = mixRgb(this.panelRgb, this.primaryRgb, glow)
          writeRgb(buffers.bg, idx * 4, bgRgb[0], bgRgb[1], bgRgb[2], 255)
        }
      }
    }
  }

  private drawEagleSprite(
    frameBuffer: OptimizedBuffer,
    frame: string[],
    startX: number,
    startY: number,
    alpha: number,
  ) {
    const width = frameBuffer.width
    const height = frameBuffer.height
    const buffers = frameBuffer.buffers

    for (let r = 0; r < frame.length; r++) {
      const line = frame[r]!
      const y = startY + r
      if (y < 0 || y >= height) continue

      for (let c = 0; c < line.length; c++) {
        const char = line[c]!
        if (char === " ") continue
        const x = startX + c
        if (x < 0 || x >= width) continue

        const idx = y * width + x
        buffers.char[idx] = char.codePointAt(0)!

        // Typographic coloring:
        // Core block / digits in brilliant white, edges / symbols in ice-blue
        const isCore = char === "█" || char === "▄" || char === "▀"
        const baseColor = isCore ? this.textRgb : this.iceBlueRgb
        const finalFg = mixRgb(this.panelRgb, baseColor, alpha)

        writeRgb(buffers.fg, idx * 4, finalFg[0], finalFg[1], finalFg[2], 255)
        if (isCore) {
          buffers.attributes[idx] = TextAttributes.BOLD
        }
      }
    }
  }

  private drawEagleHead(frameBuffer: OptimizedBuffer, alpha: number, beamCol: number | null) {
    const width = frameBuffer.width
    const height = frameBuffer.height
    const buffers = frameBuffer.buffers

    const headLines = logo.left
    for (let r = 0; r < headLines.length; r++) {
      const line = headLines[r]!
      const y = LOGO_ROW_OFFSET + r
      if (y < 0 || y >= height) continue

      for (let c = 0; c < line.length; c++) {
        const char = line[c]!
        if (char === " ") continue
        const x = c
        if (x >= width) continue

        const idx = y * width + x
        const isEye = r === 1 && c === 7

        // Shimmer intensity calculation
        let fgColor = isEye ? this.primaryRgb : this.textMutedRgb
        let bold = false

        if (beamCol !== null) {
          const dist = Math.abs(c - beamCol)
          if (dist < BEAM_RADIUS) {
            const intensity = Math.cos((dist / BEAM_RADIUS) * (Math.PI / 2))
            if (isEye) {
              fgColor = intensity > 0.7 ? mixRgb(this.primaryRgb, this.textRgb, 0.3) : this.primaryRgb
            } else {
              fgColor = mixRgb(this.textMutedRgb, this.primaryRgb, intensity)
            }
            if (intensity > 0.4) bold = true
          }
        }

        const finalFg = mixRgb(this.panelRgb, fgColor, alpha)
        const shadow = mixRgb(this.panelRgb, finalFg, 0.25)

        if (char === "_") {
          buffers.char[idx] = 32
          writeRgb(buffers.bg, idx * 4, shadow[0], shadow[1], shadow[2], 255)
        } else if (char === "^") {
          buffers.char[idx] = "▀".codePointAt(0)!
          writeRgb(buffers.fg, idx * 4, finalFg[0], finalFg[1], finalFg[2], 255)
          writeRgb(buffers.bg, idx * 4, shadow[0], shadow[1], shadow[2], 255)
        } else if (char === "~") {
          buffers.char[idx] = "▀".codePointAt(0)!
          writeRgb(buffers.fg, idx * 4, shadow[0], shadow[1], shadow[2], 255)
        } else if (char === ",") {
          buffers.char[idx] = "▄".codePointAt(0)!
          writeRgb(buffers.fg, idx * 4, shadow[0], shadow[1], shadow[2], 255)
        } else {
          buffers.char[idx] = char.codePointAt(0)!
          writeRgb(buffers.fg, idx * 4, finalFg[0], finalFg[1], finalFg[2], 255)
        }

        if (bold) {
          buffers.attributes[idx] = TextAttributes.BOLD
        }
      }
    }
  }

  private drawWordmark(
    frameBuffer: OptimizedBuffer,
    settled: boolean,
    beamCol: number | null = null,
    alpha = 1.0,
  ) {
    if (alpha <= 0) return

    const width = frameBuffer.width
    const height = frameBuffer.height
    const buffers = frameBuffer.buffers

    const rightLines = logo.right
    for (let r = 0; r < rightLines.length; r++) {
      const line = rightLines[r]!
      const y = LOGO_ROW_OFFSET + r
      if (y < 0 || y >= height) continue

      for (let c = 0; c < line.length; c++) {
        const char = line[c]!
        if (char === " ") continue
        const x = WORDMARK_START_X + c
        if (x >= width) continue

        const idx = y * width + x
        let fgColor = this.textRgb

        if (settled && beamCol !== null) {
          const dist = Math.abs(x - beamCol)
          if (dist < BEAM_RADIUS) {
            const intensity = Math.cos((dist / BEAM_RADIUS) * (Math.PI / 2))
            fgColor = mixRgb(this.textRgb, this.primaryRgb, intensity)
          }
        }

        const finalFg = mixRgb(this.panelRgb, fgColor, alpha)
        const shadow = mixRgb(this.panelRgb, finalFg, 0.25)

        if (char === "_") {
          buffers.char[idx] = 32
          writeRgb(buffers.bg, idx * 4, shadow[0], shadow[1], shadow[2], 255)
        } else if (char === "^") {
          buffers.char[idx] = "▀".codePointAt(0)!
          writeRgb(buffers.fg, idx * 4, finalFg[0], finalFg[1], finalFg[2], 255)
          writeRgb(buffers.bg, idx * 4, shadow[0], shadow[1], shadow[2], 255)
        } else if (char === "~") {
          buffers.char[idx] = "▀".codePointAt(0)!
          writeRgb(buffers.fg, idx * 4, shadow[0], shadow[1], shadow[2], 255)
        } else if (char === ",") {
          buffers.char[idx] = "▄".codePointAt(0)!
          writeRgb(buffers.fg, idx * 4, shadow[0], shadow[1], shadow[2], 255)
        } else {
          buffers.char[idx] = char.codePointAt(0)!
          writeRgb(buffers.fg, idx * 4, finalFg[0], finalFg[1], finalFg[2], 255)
        }

        buffers.attributes[idx] = TextAttributes.BOLD
      }
    }
  }
}
