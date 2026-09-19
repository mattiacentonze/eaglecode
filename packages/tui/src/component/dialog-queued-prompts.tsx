import { TextAttributes } from "@opentui/core"
import { For, Show, createMemo, createSignal } from "solid-js"
import { useDialog } from "../ui/dialog"
import { useSync } from "../context/sync"
import { useTheme } from "../context/theme"
import { useBindings } from "../keymap"
import { useSDK } from "../context/sdk"

export type DialogQueuedPromptsProps = {
  sessionID: string
  onEdit?: (prompt: { messageID: string; text: string }) => void
}

export function DialogQueuedPrompts(props: DialogQueuedPromptsProps) {
  const dialog = useDialog()
  const sync = useSync()
  const sdk = useSDK()
  const { theme } = useTheme()
  const [selected, setSelected] = createSignal(0)

  const items = createMemo(() => sync.data.queued?.[props.sessionID] ?? [])

  function deleteItem(index: number) {
    const current = items()
    if (index < 0 || index >= current.length) return
    const item = current[index]
    if (!item) return
    void sdk.client.session.queuedRemove({ sessionID: props.sessionID, messageID: item.messageID })
    if (selected() >= current.length - 1) {
      setSelected(Math.max(0, current.length - 2))
    }
  }

  function moveUp(index: number) {
    if (index <= 0) return
    const current = items()
    const item = current[index]
    if (!item) return
    void sdk.client.session.queuedReorder({ sessionID: props.sessionID, messageID: item.messageID, direction: "up" })
    setSelected(index - 1)
  }

  function moveDown(index: number) {
    const current = items()
    if (index >= current.length - 1) return
    const item = current[index]
    if (!item) return
    void sdk.client.session.queuedReorder({ sessionID: props.sessionID, messageID: item.messageID, direction: "down" })
    setSelected(index + 1)
  }

  function editItem(index: number) {
    const item = items()[index]
    if (!item) return
    void sdk.client.session.queuedRemove({ sessionID: props.sessionID, messageID: item.messageID })
    dialog.clear()
    props.onEdit?.(item)
  }

  useBindings(() => ({
    enabled: true,
    priority: 1,
    commands: [
      {
        name: "dialog.queued.up",
        title: "Previous queued prompt",
        category: "Dialog",
        run: () => setSelected((s) => Math.max(0, s - 1)),
      },
      {
        name: "dialog.queued.down",
        title: "Next queued prompt",
        category: "Dialog",
        run: () => setSelected((s) => Math.max(0, Math.min(items().length - 1, s + 1))),
      },
      {
        name: "dialog.queued.edit",
        title: "Edit queued prompt",
        category: "Dialog",
        run: () => editItem(selected()),
      },
      {
        name: "dialog.queued.delete",
        title: "Delete queued prompt",
        category: "Dialog",
        run: () => deleteItem(selected()),
      },
      {
        name: "dialog.queued.move_up",
        title: "Move queued prompt up",
        category: "Dialog",
        run: () => moveUp(selected()),
      },
      {
        name: "dialog.queued.move_down",
        title: "Move queued prompt down",
        category: "Dialog",
        run: () => moveDown(selected()),
      },
      {
        name: "dialog.queued.close",
        title: "Close queued prompts dialog",
        category: "Dialog",
        run: () => dialog.clear(),
      },
    ],
    bindings: [
      { key: "up", command: "dialog.queued.up" },
      { key: "down", command: "dialog.queued.down" },
      { key: "k", command: "dialog.queued.up" },
      { key: "j", command: "dialog.queued.down" },
      { key: "return", command: "dialog.queued.edit" },
      { key: "ctrl+d", command: "dialog.queued.delete" },
      { key: "d", command: "dialog.queued.delete" },
      { key: "alt+up", command: "dialog.queued.move_up" },
      { key: "alt+down", command: "dialog.queued.move_down" },
      { key: "escape", command: "dialog.queued.close" },
    ],
  }))

  return (
    <box flexDirection="column" width={60} paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Queued Prompts ({items().length})
        </text>
        <text fg={theme.textMuted}>
          Enter: edit · d: delete · Alt+↑/↓: move
        </text>
      </box>
      <Show
        when={items().length > 0}
        fallback={
          <box paddingTop={1} paddingBottom={1}>
            <text fg={theme.textMuted}>No queued prompts for this session</text>
          </box>
        }
      >
        <box flexDirection="column" gap={0}>
          <For each={items()}>
            {(item, index) => {
              const isSelected = () => selected() === index()
              return (
                <box
                  flexDirection="row"
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={isSelected() ? theme.primary : undefined}
                  onMouseDown={() => setSelected(index())}
                  onMouseUp={() => editItem(index())}
                >
                  <text
                    fg={isSelected() ? theme.text : theme.textMuted}
                    flexGrow={1}
                    wrapMode="none"
                  >
                    {`${index() + 1}. `}{item.text.length > 50 ? item.text.slice(0, 47) + "..." : item.text}
                  </text>
                  <box flexDirection="row" gap={1} flexShrink={0}>
                    <box
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => {
                        e.stopPropagation()
                        moveUp(index())
                      }}
                    >
                      <text fg={isSelected() ? theme.text : theme.textMuted}>▲</text>
                    </box>
                    <box
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => {
                        e.stopPropagation()
                        moveDown(index())
                      }}
                    >
                      <text fg={isSelected() ? theme.text : theme.textMuted}>▼</text>
                    </box>
                    <box
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => {
                        e.stopPropagation()
                        deleteItem(index())
                      }}
                    >
                      <text fg={isSelected() ? theme.text : theme.textMuted}>✕</text>
                    </box>
                  </box>
                </box>
              )
            }}
          </For>
        </box>
      </Show>
    </box>
  )
}
