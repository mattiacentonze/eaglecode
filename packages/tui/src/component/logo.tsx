import { RGBA, TextAttributes } from "@opentui/core"
import { createEffect, createSignal, For, onCleanup, type JSX } from "solid-js"
import { tint, useTheme } from "../context/theme"
import { useKV } from "../context/kv"
import { logo } from "../logo"

const SWEEP_MS = 1200
const IDLE_MS = 2500
const FRAME_MS = 40
const START_COL = -3
const END_COL = 60
const BEAM_RADIUS = 3.5

export function Logo() {
  const { theme } = useTheme()
  const kv = useKV()
  const [beamCol, setBeamCol] = createSignal<number | null>(null)

  createEffect(() => {
    if (!kv.get("animations_enabled", true)) {
      setBeamCol(null)
      return
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    let active = true

    const step = (startTime: number) => {
      if (!active) return
      const elapsed = Date.now() - startTime
      if (elapsed >= SWEEP_MS) {
        setBeamCol(null)
        timer = setTimeout(() => {
          if (!active) return
          step(Date.now())
        }, IDLE_MS)
        return
      }
      const progress = elapsed / SWEEP_MS
      setBeamCol(START_COL + progress * (END_COL - START_COL))
      timer = setTimeout(() => step(startTime), FRAME_MS)
    }

    timer = setTimeout(() => step(Date.now()), 300)

    onCleanup(() => {
      active = false
      if (timer) clearTimeout(timer)
      setBeamCol(null)
    })
  })

  const renderLine = (line: string, rowIndex: number, colOffset: number): JSX.Element[] => {
    const isRight = colOffset > 0
    const baseFg = isRight ? theme.text : theme.textMuted
    const baseBold = isRight

    return Array.from(line).map((char, charIndex) => {
      const col = colOffset + charIndex
      const isEye = !isRight && rowIndex === 1 && col === 7

      const fg = () => {
        const beam = beamCol()
        if (beam === null) return baseFg
        const dist = Math.abs(col - beam)
        if (dist >= BEAM_RADIUS) return baseFg
        const intensity = Math.cos((dist / BEAM_RADIUS) * (Math.PI / 2))
        if (isEye) {
          if (intensity > 0.7) return tint(theme.primary, theme.text, 0.3)
          return tint(baseFg, theme.primary, Math.min(1, intensity * 1.5))
        }
        return tint(baseFg, theme.primary, intensity)
      }

      const attrs = () => {
        const beam = beamCol()
        if (beam === null) return baseBold ? TextAttributes.BOLD : undefined
        const dist = Math.abs(col - beam)
        if (dist >= BEAM_RADIUS) return baseBold ? TextAttributes.BOLD : undefined
        if (isRight || isEye) return TextAttributes.BOLD
        const intensity = Math.cos((dist / BEAM_RADIUS) * (Math.PI / 2))
        if (intensity > 0.4) return TextAttributes.BOLD
        return undefined
      }

      const shadow = () => tint(theme.background, fg(), 0.25)

      if (char === "_") {
        return (
          <text fg={fg()} bg={shadow()} attributes={attrs()} selectable={false}>
            {" "}
          </text>
        )
      }
      if (char === "^") {
        return (
          <text fg={fg()} bg={shadow()} attributes={attrs()} selectable={false}>
            ▀
          </text>
        )
      }
      if (char === "~") {
        return (
          <text fg={shadow()} attributes={attrs()} selectable={false}>
            ▀
          </text>
        )
      }
      if (char === ",") {
        return (
          <text fg={shadow()} attributes={attrs()} selectable={false}>
            ▄
          </text>
        )
      }
      return (
        <text fg={fg()} attributes={attrs()} selectable={false}>
          {char}
        </text>
      )
    })
  }

  return (
    <box>
      <For each={logo.left}>
        {(line, index) => (
          <box flexDirection="row" gap={1}>
            <box flexDirection="row">{renderLine(line, index(), 0)}</box>
            <box flexDirection="row">{renderLine(logo.right[index()], index(), 16)}</box>
          </box>
        )}
      </For>
    </box>
  )
}
