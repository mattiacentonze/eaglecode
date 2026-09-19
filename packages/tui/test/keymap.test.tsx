/** @jsxImportSource @opentui/solid */
import { TextareaRenderable } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { createBindingLookup } from "@opentui/keymap/extras"
import { testRender, useRenderer } from "@opentui/solid"
import { expect, test } from "bun:test"
import { onCleanup } from "solid-js"
import { TuiKeybind } from "../src/config/keybind"
import { getOpencodeModeStack, OPENCODE_BASE_MODE, OpencodeKeymapProvider, registerOpencodeKeymap } from "../src/keymap"

function createResolvedKeymapConfig(input: TuiKeybind.KeybindOverrides = {}) {
  const keybinds = TuiKeybind.parse(input)
  return {
    keybinds: createBindingLookup(TuiKeybind.toBindingConfig(keybinds), {
      commandMap: TuiKeybind.CommandMap,
      bindingDefaults: TuiKeybind.bindingDefaults(),
    }),
    leader_timeout: 2000,
  }
}

test("legacy page key aliases compile as page keys", async () => {
  const sequences: Record<string, string[][]> = {}

  function Harness() {
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    const config = createResolvedKeymapConfig({
      messages_page_up: "pgup",
      messages_page_down: "pgdown",
    })
    const offKeymap = registerOpencodeKeymap(keymap, renderer, config)
    const offLayer = keymap.registerLayer({
      bindings: config.keybinds.gather("session", ["session.page.up", "session.page.down"]),
    })
    const bindings = keymap.getCommandBindings({
      visibility: "registered",
      commands: ["session.page.up", "session.page.down"],
    })
    sequences.up =
      bindings.get("session.page.up")?.map((binding) => binding.sequence.map((part) => part.stroke.name)) ?? []
    sequences.down =
      bindings.get("session.page.down")?.map((binding) => binding.sequence.map((part) => part.stroke.name)) ?? []
    onCleanup(() => {
      offLayer()
      offKeymap()
    })

    return (
      <OpencodeKeymapProvider keymap={keymap}>
        <box />
      </OpencodeKeymapProvider>
    )
  }

  const app = await testRender(() => <Harness />)
  try {
    expect(sequences).toEqual({
      up: [["pageup"]],
      down: [["pagedown"]],
    })
  } finally {
    app.renderer.destroy()
  }
})

test("mode-less bindings stay active when opencode mode changes", async () => {
  const counts: Record<string, Record<string, number>> = {}

  function Harness() {
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    const config = createResolvedKeymapConfig()
    const offKeymap = registerOpencodeKeymap(keymap, renderer, config)
    const offGlobal = keymap.registerLayer({
      commands: [
        { name: "session.list", run() {} },
        { name: "session.new", run() {} },
        { name: "session.page.up", run() {} },
        { name: "session.first", run() {} },
      ],
      bindings: config.keybinds.gather("test.global", [
        "session.list",
        "session.new",
        "session.page.up",
        "session.first",
      ]),
    })
    const offBase = keymap.registerLayer({
      mode: OPENCODE_BASE_MODE,
      commands: [{ name: "model.list", run() {} }],
      bindings: config.keybinds.gather("test.base", ["model.list"]),
    })
    const activeCounts = () =>
      Object.fromEntries(
        Array.from(
          keymap.getCommandBindings({
            visibility: "active",
            commands: ["session.list", "session.new", "session.page.up", "session.first", "model.list"],
          }),
          ([command, bindings]) => [command, bindings.length],
        ),
      )

    counts.base = activeCounts()
    const popQuestion = getOpencodeModeStack(keymap).push("question")
    counts.question = activeCounts()
    popQuestion()
    const popAutocomplete = getOpencodeModeStack(keymap).push("autocomplete")
    counts.autocomplete = activeCounts()
    popAutocomplete()

    onCleanup(() => {
      offBase()
      offGlobal()
      offKeymap()
    })

    return (
      <OpencodeKeymapProvider keymap={keymap}>
        <box />
      </OpencodeKeymapProvider>
    )
  }

  const app = await testRender(() => <Harness />)
  try {
    expect(counts).toEqual({
      base: { "session.list": 1, "session.new": 1, "session.page.up": 2, "session.first": 2, "model.list": 1 },
      question: { "session.list": 1, "session.new": 1, "session.page.up": 2, "session.first": 2, "model.list": 0 },
      autocomplete: {
        "session.list": 1,
        "session.new": 1,
        "session.page.up": 2,
        "session.first": 2,
        "model.list": 0,
      },
    })
  } finally {
    app.renderer.destroy()
  }
})

test("home and end keys resolve to session.first/last when unfocused and input.buffer.home/end when textarea is focused", async () => {
  let textareaRef: TextareaRenderable | undefined
  let keymapRef: ReturnType<typeof createDefaultOpenTuiKeymap> | undefined
  let rendererRef: ReturnType<typeof useRenderer> | undefined

  function Harness() {
    const renderer = useRenderer()
    rendererRef = renderer
    const keymap = createDefaultOpenTuiKeymap(renderer)
    keymapRef = keymap
    const config = createResolvedKeymapConfig()
    const offKeymap = registerOpencodeKeymap(keymap, renderer, config)

    const sessionBindingCommands = [
      "session.share",
      "session.rename",
      "session.timeline",
      "session.messages_last_user",
    ] as const

    const offBase = keymap.registerLayer({
      mode: OPENCODE_BASE_MODE,
      bindings: config.keybinds.gather("session", sessionBindingCommands),
    })

    const offCommands = keymap.registerLayer({
      commands: [
        { name: "session.first", run() {} },
        { name: "session.last", run() {} },
      ],
    })

    const offUnfocused = keymap.registerLayer({
      enabled: () => renderer.currentFocusedEditor === null,
      bindings: config.keybinds.gather("session.global.unfocused", ["session.first", "session.last"]),
    })

    onCleanup(() => {
      offUnfocused()
      offCommands()
      offBase()
      offKeymap()
    })

    return (
      <OpencodeKeymapProvider keymap={keymap}>
        <box>
          <textarea ref={(el) => (textareaRef = el)} />
        </box>
      </OpencodeKeymapProvider>
    )
  }

  const app = await testRender(() => <Harness />)
  try {
    const commands = ["session.first", "session.last", "input.buffer.home", "input.buffer.end"]

    // 1. Unfocused scenario: no editor focused
    textareaRef?.blur()
    expect(rendererRef?.currentFocusedEditor).toBeNull()
    const unfocusedBindings = keymapRef!.getCommandBindings({
      visibility: "active",
      commands,
    })
    expect(unfocusedBindings.get("session.first")?.length ?? 0).toBeGreaterThan(0)
    expect(unfocusedBindings.get("session.last")?.length ?? 0).toBeGreaterThan(0)
    expect(unfocusedBindings.get("input.buffer.home")?.length ?? 0).toBe(0)
    expect(unfocusedBindings.get("input.buffer.end")?.length ?? 0).toBe(0)

    // Verify key strokes
    const homeBinding = unfocusedBindings.get("session.first")?.find((b) => b.sequence[0]?.stroke.name === "home")
    expect(homeBinding).toBeDefined()
    const endBinding = unfocusedBindings.get("session.last")?.find((b) => b.sequence[0]?.stroke.name === "end")
    expect(endBinding).toBeDefined()

    // 2. Focused scenario: textarea focused
    textareaRef?.focus()
    expect(rendererRef?.currentFocusedEditor).toBe(textareaRef)
    const focusedBindings = keymapRef!.getCommandBindings({
      visibility: "active",
      commands,
    })
    expect(focusedBindings.get("session.first")?.length ?? 0).toBe(0)
    expect(focusedBindings.get("session.last")?.length ?? 0).toBe(0)
    expect(focusedBindings.get("input.buffer.home")?.length ?? 0).toBeGreaterThan(0)
    expect(focusedBindings.get("input.buffer.end")?.length ?? 0).toBeGreaterThan(0)

    // Verify key strokes
    const focusedHomeBinding = focusedBindings
      .get("input.buffer.home")
      ?.find((b) => b.sequence[0]?.stroke.name === "home")
    expect(focusedHomeBinding).toBeDefined()
    const focusedEndBinding = focusedBindings.get("input.buffer.end")?.find((b) => b.sequence[0]?.stroke.name === "end")
    expect(focusedEndBinding).toBeDefined()
  } finally {
    app.renderer.destroy()
  }
})
