import { TextAttributes } from "@opentui/core"
import { For, createMemo } from "solid-js"
import { useDialog } from "../ui/dialog"
import { useTheme } from "../context/theme"
import { useBindings } from "../keymap"

export type DialogShortcutsProps = {
  sessionID?: string
}

type ShortcutGroup = {
  category: string
  items: { key: string; label: string }[]
}

export function DialogShortcuts(_props: DialogShortcutsProps) {
  const dialog = useDialog()
  const { theme } = useTheme()

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

  const groups = createMemo<ShortcutGroup[]>(() => [
    {
      category: "Prompt & Input",
      items: [
        { key: "Enter", label: "Submit prompt (or steer when busy)" },
        { key: "Tab", label: "Enqueue prompt" },
        { key: "Shift+Enter", label: "Newline (Shift+Enter / Ctrl+J)" },
        { key: "Shift+Tab", label: "Cycle agent (build, plan, etc.)" },
        { key: "Ctrl+T", label: "Cycle model variant / reasoning" },
        { key: "Ctrl+C", label: "Clear prompt" },
        { key: "Ctrl+P", label: "Command palette" },
        { key: "/", label: "Slash commands autocomplete" },
        { key: "!", label: "Shell command shorthand" },
        { key: "@", label: "File / directory mention" },
      ],
    },
    {
      category: "Navigation & Actions",
      items: [
        { key: "Escape", label: "Interrupt session (or send steer immediately)" },
        { key: "PageUp / PageDown", label: "Scroll messages" },
        { key: "Home / End", label: "Jump to first / last message" },
        { key: "Ctrl+X e", label: "Open in external editor (/editor)" },
        { key: "Ctrl+X m", label: "Model selector (/model)" },
        { key: "Ctrl+X a", label: "Agent selector (/agent)" },
        { key: "Ctrl+X l", label: "Session list" },
        { key: "Ctrl+X t", label: "Theme selector" },
        { key: "?", label: "Toggle shortcuts help" },
        { key: "q / Esc", label: "Close this dialog" },
      ],
    },
  ])

  return (
    <box flexDirection="column" width={64} paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Keyboard Shortcuts
        </text>
        <text fg={theme.textMuted}>q / Esc to close</text>
      </box>
      <box flexDirection="column" gap={1}>
        <For each={groups()}>
          {(group) => (
            <box flexDirection="column" gap={0}>
              <box marginBottom={0}>
                <text fg={theme.primary} attributes={TextAttributes.BOLD}>
                  {group.category}
                </text>
              </box>
              <For each={group.items}>
                {(item) => (
                  <box flexDirection="row" gap={1}>
                    <box width={20}>
                      <text fg={theme.text}>{item.key}</text>
                    </box>
                    <text fg={theme.textMuted}>{item.label}</text>
                  </box>
                )}
              </For>
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
