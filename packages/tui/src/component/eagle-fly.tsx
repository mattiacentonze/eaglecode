import {
  FrameBufferRenderable,
  RGBA,
  type OptimizedBuffer,
  type RenderContext,
  type RenderableOptions,
} from "@opentui/core"
import { extend, useRenderer } from "@opentui/solid"
import { onCleanup, onMount } from "solid-js"
import { useKV } from "../context/kv"
import { useTheme } from "../context/theme"
import { EagleFlyPainter } from "./eagle-fly-render"

type EagleFlyOptions = RenderableOptions<FrameBufferRenderable> & {
  backgroundPanel?: RGBA
  primary?: RGBA
  text?: RGBA
  textMuted?: RGBA
  animationEnabled?: boolean
}

class EagleFlyRenderable extends FrameBufferRenderable {
  private painter = new EagleFlyPainter()

  constructor(ctx: RenderContext, options: EagleFlyOptions = {}) {
    const width = typeof options.width === "number" ? options.width : 56
    const height = typeof options.height === "number" ? options.height : 7
    super(ctx, {
      ...options,
      width,
      height,
      live: options.live ?? true,
      respectAlpha: false,
    })

    if (options.width !== undefined && typeof options.width !== "number") this.width = options.width
    if (options.height !== undefined && typeof options.height !== "number") this.height = options.height

    this.painter.setPanelBackground(options.backgroundPanel)
    this.painter.setPrimary(options.primary)
    this.painter.setText(options.text)
    this.painter.setTextMuted(options.textMuted)
    this.painter.setAnimationEnabled(options.animationEnabled ?? true)
  }

  set backgroundPanel(value: RGBA | undefined) {
    if (this.painter.setPanelBackground(value)) this.requestRender()
  }

  set primary(value: RGBA | undefined) {
    if (this.painter.setPrimary(value)) this.requestRender()
  }

  set text(value: RGBA | undefined) {
    if (this.painter.setText(value)) this.requestRender()
  }

  set textMuted(value: RGBA | undefined) {
    if (this.painter.setTextMuted(value)) this.requestRender()
  }

  set animationEnabled(value: boolean | undefined) {
    this.painter.setAnimationEnabled(value ?? true)
    this.requestRender()
  }

  get isAnimationFinished(): boolean {
    return this.painter.isAnimationFinished()
  }

  protected override renderSelf(buffer: OptimizedBuffer, deltaTime = 0): void {
    if (!this.visible || this.isDestroyed) return

    this.painter.render(this.frameBuffer, {
      deltaTime,
      rgb: this._ctx.capabilities?.rgb === true,
    })
    super.renderSelf(buffer)
  }
}

declare module "@opentui/solid" {
  interface OpenTUIComponents {
    eagle_fly: typeof EagleFlyRenderable
  }
}

extend({ eagle_fly: EagleFlyRenderable })

export function EagleFly() {
  const { theme } = useTheme()
  const kv = useKV()
  const renderer = useRenderer()
  let targetFps = renderer.targetFps
  let maxFps = renderer.maxFps

  onMount(() => {
    targetFps = renderer.targetFps
    maxFps = renderer.maxFps
    renderer.targetFps = 30
    renderer.maxFps = 30
  })

  onCleanup(() => {
    renderer.targetFps = targetFps
    renderer.maxFps = maxFps
  })

  return (
    <eagle_fly
      width={56}
      height={7}
      backgroundPanel={theme.background}
      primary={theme.primary}
      text={theme.text}
      textMuted={theme.textMuted}
      animationEnabled={kv.get("animations_enabled", true)}
      live
    />
  )
}
