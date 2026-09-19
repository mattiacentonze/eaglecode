import { TextAttributes } from "@opentui/core"
import { For, createMemo } from "solid-js"
import { useDialog } from "../ui/dialog"
import { useSync } from "../context/sync"
import { useTheme } from "../context/theme"
import { useBindings, useCommandShortcut } from "../keymap"

export type DialogShortcutsProps = {
  sessionID?: string
}

export function DialogShortcuts(props: DialogShortcutsProps) {
  const dialog = useDialog()
  const sync = useSync()
  const { theme } = useTheme()

  const status = createMemo(() => {
    if (!props.sessionID) return { type: "idle" }
    return sync.data.session_status?.[props.sessionID] ?? { type: "idle" }
  })

  const isRunning = createMemo(() => status().type !== "idle")

  const enterShortcut = useCommandShortcut("input.submit")
  const submitKey = createMemo(() => {
    const raw = enterShortcut()
    if (!raw || raw === "return" || raw.toLowerCase() === "enter") return "Enter"
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  })

  const queueShortcut = useCommandShortcut("prompt.queue")
  const queueKey = createMemo(() => {
    const raw = queueShortcut()
    if (!raw || raw.toLowerCase() === "tab") return "Tab"
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  })

  useBindings(() => ({
    enabled: true,
    priority: 20,
    commands: [
      {
        name: "dialog.shortcuts.close",
        title: "Close shortcuts dialog",
        category: "Dialog",
        run: () => dialog.clear(),
      },
    ],
    bindings: [
      { key: "escape", cmd: "dialog.shortcuts.close" },
      { key: "q", cmd: "dialog.shortcuts.close" },
      { key: "?", cmd: "dialog.shortcuts.close" },
    ],
  }))

  const shortcuts = createMemo(() => [
    { key: "/", label: "for commands" },
    { key: "!", label: "for shell commands" },
    { key: "Shift+Enter", label: "for newline" },
    { key: isRunning() ? queueKey() : submitKey(), label: isRunning() ? "to queue message" : "to submit message" },
    { key: "@", label: "for file paths" },
    { key: "Ctrl+V", label: "to paste images" },
    { key: "Ctrl+G", label: "to edit in external editor" },
    { key: "Esc Esc", label: "to edit previous message" },
    { key: "Ctrl+R", label: "search history" },
    { key: "Ctrl+C", label: isRunning() ? "to interrupt" : "to exit" },
    { key: "Alt+,", label: "reasoning down" },
    { key: "Alt+.", label: "reasoning up" },
    { key: "Shift+Tab", label: "to change mode" },
    { key: "Ctrl+T", label: "to view transcript" },
  ])

  return (
    <box flexDirection="column" width={54} paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Keyboard Shortcuts
        </text>
        <text fg={theme.textMuted}>Esc to close</text>
      </box>
      <box flexDirection="column" gap={0}>
        <For each={shortcuts()}>
          {(item) => (
            <box flexDirection="row" gap={1}>
              <box width={14}>
                <text fg={theme.text}>{item.key}</text>
              </box>
              <text fg={theme.textMuted}>{item.label}</text>
            </box>
          )}
        </For>
      </box>
      <box marginTop={1}>
        <text fg={theme.textMuted}>
          customize shortcuts with <span style={{ fg: "cyan" }}>/keymap</span>
        </text>
      </box>
    </box>
  )
}
