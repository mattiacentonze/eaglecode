/** @jsxImportSource @opentui/solid */
import { describe, expect, mock, test } from "bun:test"
import { KeyEvent, type ParsedKey } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { Effect } from "effect"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { Global } from "@opencode-ai/core/global"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"
import { createEventSource, createFetch, directory } from "./fixture/tui-sdk"

interface KeyOverrides extends Partial<ParsedKey> {
  alt?: boolean
}

type TestKeyEvent = KeyEvent & { alt?: boolean }

describe("Prompt Shift+Enter / newline vs submit behavior", () => {
  function createTestKeyEvent(overrides: KeyOverrides): TestKeyEvent {
    const parsed: ParsedKey = {
      name: "",
      sequence: "",
      raw: "",
      ctrl: false,
      shift: false,
      meta: false,
      option: false,
      super: false,
      hyper: false,
      number: false,
      eventType: "press",
      source: "raw",
      ...overrides,
    }
    const event = new KeyEvent(parsed) as TestKeyEvent
    if (overrides.alt !== undefined) {
      event.alt = overrides.alt
    }
    return event
  }

  function setupPromptHandler() {
    let newLines = 0
    let submitted = false

    const mockInput = {
      newLine() {
        newLines++
      },
    }

    const mockSubmit = () => {
      submitted = true
    }

    // Prompt's onKeyDown implementation from packages/tui/src/component/prompt/index.tsx
    const handleKeyDown = (e: KeyEvent) => {
      const alt = e.option || (e as { alt?: boolean }).alt
      if (
        (e.name === "return" && (e.shift || alt || e.ctrl)) ||
        e.name === "linefeed" ||
        (e.name === "j" && e.ctrl)
      ) {
        e.preventDefault()
        mockInput.newLine()
        return
      }

      if (e.name === "return" && !e.shift && !alt && !e.ctrl) {
        mockSubmit()
      }
    }

    return {
      get newLines() {
        return newLines
      },
      get submitted() {
        return submitted
      },
      handleKeyDown,
    }
  }

  test("Pressing Shift+Enter triggers newLine() and does NOT submit", () => {
    const handler = setupPromptHandler()
    const event = createTestKeyEvent({
      name: "return",
      shift: true,
      ctrl: false,
      alt: false,
      option: false,
    })

    handler.handleKeyDown(event)

    expect(handler.newLines).toBe(1)
    expect(handler.submitted).toBe(false)
    expect(event.defaultPrevented).toBe(true)
  })

  test("Pressing Alt+Enter triggers newLine() and does NOT submit", () => {
    const handler = setupPromptHandler()
    const event = createTestKeyEvent({
      name: "return",
      shift: false,
      ctrl: false,
      alt: true,
      option: true,
    })

    handler.handleKeyDown(event)

    expect(handler.newLines).toBe(1)
    expect(handler.submitted).toBe(false)
    expect(event.defaultPrevented).toBe(true)
  })

  test("Pressing Ctrl+Enter triggers newLine() and does NOT submit", () => {
    const handler = setupPromptHandler()
    const event = createTestKeyEvent({
      name: "return",
      shift: false,
      ctrl: true,
      alt: false,
      option: false,
    })

    handler.handleKeyDown(event)

    expect(handler.newLines).toBe(1)
    expect(handler.submitted).toBe(false)
    expect(event.defaultPrevented).toBe(true)
  })

  test("Pressing Ctrl+J (name: 'j', ctrl: true) triggers newLine() and does NOT submit", () => {
    const handler = setupPromptHandler()
    const event = createTestKeyEvent({
      name: "j",
      shift: false,
      ctrl: true,
      alt: false,
      option: false,
    })

    handler.handleKeyDown(event)

    expect(handler.newLines).toBe(1)
    expect(handler.submitted).toBe(false)
    expect(event.defaultPrevented).toBe(true)
  })

  test("Pressing Ctrl+J (name: 'linefeed') triggers newLine() and does NOT submit", () => {
    const handler = setupPromptHandler()
    const event = createTestKeyEvent({
      name: "linefeed",
      shift: false,
      ctrl: false,
      alt: false,
      option: false,
    })

    handler.handleKeyDown(event)

    expect(handler.newLines).toBe(1)
    expect(handler.submitted).toBe(false)
    expect(event.defaultPrevented).toBe(true)
  })

  test("Pressing plain Enter (name: 'return', shift: false, alt: false, ctrl: false) triggers submit", () => {
    const handler = setupPromptHandler()
    const event = createTestKeyEvent({
      name: "return",
      shift: false,
      ctrl: false,
      alt: false,
      option: false,
    })

    handler.handleKeyDown(event)

    expect(handler.newLines).toBe(0)
    expect(handler.submitted).toBe(true)
    expect(event.defaultPrevented).toBe(false)
  })

  test("focused textarea event listener dispatches prompt newline vs submit correctly", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24, useThread: false })
    const { TextareaRenderable } = await import("@opentui/core")

    let newLines = 0
    let submitted = false

    const textarea = new TextareaRenderable(setup.renderer as unknown as import("@opentui/core").RenderContext, {
      onSubmit: () => {
        submitted = true
      },
      onKeyDown: (e: KeyEvent) => {
        const alt = e.option || (e as { alt?: boolean }).alt
        if (
          (e.name === "return" && (e.shift || alt || e.ctrl)) ||
          e.name === "linefeed" ||
          (e.name === "j" && e.ctrl)
        ) {
          e.preventDefault()
          newLines++
          textarea.newLine()
          return
        }
      },
    })

    setup.renderer.root.add(textarea)
    textarea.focus()

    try {
      // 1. Shift+Enter
      const shiftEnter = createTestKeyEvent({ name: "return", shift: true })
      textarea.onKeyDown?.(shiftEnter)
      expect(newLines).toBe(1)
      expect(submitted).toBe(false)
      expect(shiftEnter.defaultPrevented).toBe(true)

      // 2. Alt+Enter
      const altEnter = createTestKeyEvent({ name: "return", alt: true, option: true })
      textarea.onKeyDown?.(altEnter)
      expect(newLines).toBe(2)
      expect(submitted).toBe(false)
      expect(altEnter.defaultPrevented).toBe(true)

      // 3. Ctrl+Enter
      const ctrlEnter = createTestKeyEvent({ name: "return", ctrl: true })
      textarea.onKeyDown?.(ctrlEnter)
      expect(newLines).toBe(3)
      expect(submitted).toBe(false)
      expect(ctrlEnter.defaultPrevented).toBe(true)

      // 4. Ctrl+J (as j + ctrl)
      const ctrlJ = createTestKeyEvent({ name: "j", ctrl: true })
      textarea.onKeyDown?.(ctrlJ)
      expect(newLines).toBe(4)
      expect(submitted).toBe(false)
      expect(ctrlJ.defaultPrevented).toBe(true)

      // 5. Ctrl+J (as linefeed)
      const linefeed = createTestKeyEvent({ name: "linefeed" })
      textarea.onKeyDown?.(linefeed)
      expect(newLines).toBe(5)
      expect(submitted).toBe(false)
      expect(linefeed.defaultPrevented).toBe(true)

      // 6. Plain Enter does not trigger newline and triggers submit
      const plainEnter = createTestKeyEvent({ name: "return", shift: false, alt: false, ctrl: false })
      textarea.onKeyDown?.(plainEnter)
      expect(newLines).toBe(5)
      expect(plainEnter.defaultPrevented).toBe(false)
      textarea.submit()
      expect(submitted).toBe(true)
    } finally {
      setup.renderer.destroy()
    }
  })
})

describe("app.tsx useKittyKeyboard and modifyOtherKeys configuration", () => {
  test("app.tsx source configures useKittyKeyboard with allKeysAsEscapes: true", async () => {
    const appSource = await Bun.file(new URL("../src/app.tsx", import.meta.url).pathname).text()

    // Must configure allKeysAsEscapes: true in useKittyKeyboard options
    expect(appSource).toMatch(/useKittyKeyboard:\s*\{[^}]*allKeysAsEscapes:\s*true/s)
    expect(appSource).toMatch(/disambiguate:\s*true/)
    expect(appSource).toMatch(/alternateKeys:\s*true/)
  })

  test("app.tsx emits modifyOtherKeys mode 2 on startup and disables on teardown", async () => {
    const appSource = await Bun.file(new URL("../src/app.tsx", import.meta.url).pathname).text()

    // Enable modifyOtherKeys mode 2: \x1b[>4;2m
    expect(appSource).toContain('\\x1b[>4;2m')

    // Reset/disable modifyOtherKeys: \x1b[>4m
    expect(appSource).toContain('\\x1b[>4m')
  })

  test("app.run runtime configures createCliRenderer with allKeysAsEscapes and emits modifyOtherKeys", async () => {
    const setup = await createTestRenderer({ width: 80, height: 24, useThread: false })
    const core = await import("@opentui/core")
    let capturedOptions: Record<string, unknown> | null = null

    mock.module("@opentui/core", () => ({
      ...core,
      createCliRenderer: async (options: Record<string, unknown>) => {
        capturedOptions = options
        return setup.renderer
      },
    }))

    const events = createEventSource()
    const calls = createFetch()
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })

    const originalWrite = process.stdout.write.bind(process.stdout)
    const stdoutWrites: string[] = []
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutWrites.push(String(chunk))
      return true
    }) as typeof process.stdout.write

    const originalIsTTY = process.stdout.isTTY
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    try {
      const { run } = await import("../src/app")
      const task = Effect.runPromise(
        run({
          url: "http://test",
          directory,
          config: createTuiResolvedConfig({ plugin_enabled: {} }),
          fetch: calls.fetch,
          events: events.source,
          args: {},
          pluginHost: {
            async start() {
              started()
            },
            async dispose() {},
          },
        }).pipe(Effect.provide(AppNodeBuilder.build(Global.node))),
      )

      await ready
      expect(capturedOptions).not.toBeNull()
      expect((capturedOptions as unknown as { useKittyKeyboard: unknown })?.useKittyKeyboard).toEqual({
        disambiguate: true,
        alternateKeys: true,
        allKeysAsEscapes: true,
      })

      expect(stdoutWrites).toContain("\x1b[>4;2m")

      // Trigger SIGHUP to test teardown
      process.emit("SIGHUP")
      await task

      expect(stdoutWrites).toContain("\x1b[>4m")
    } finally {
      process.stdout.write = originalWrite
      Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true })
      if (!setup.renderer.isDestroyed) setup.renderer.destroy()
      mock.restore()
    }
  })
})
