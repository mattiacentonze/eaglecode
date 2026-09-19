import { For, Show, createMemo, createSignal } from "solid-js"
import { useSync } from "../../context/sync"
import { useTheme } from "../../context/theme"
import { useSDK } from "../../context/sdk"

export type QueuedPromptItem = {
  messageID: string
  text: string
}

export type QueuedProps = {
  sessionID?: string
  onEdit?: (prompt: QueuedPromptItem) => void
  onDelete?: (messageID: string) => void
  onMoveUp?: (index: number) => void
  onMoveDown?: (index: number) => void
}

export function Queued(props: QueuedProps) {
  const sync = useSync()
  const sdk = useSDK()
  const { theme } = useTheme()
  const [selected, setSelected] = createSignal(0)

  const items = createMemo<QueuedPromptItem[]>(() => {
    if (!props.sessionID) return []
    return sync.data.queued?.[props.sessionID] ?? []
  })

  return (
    <Show when={items().length > 0}>
      <box
        flexDirection="column"
        border={["top", "bottom"]}
        borderColor={theme.border}
        paddingTop={0}
        paddingBottom={0}
        backgroundColor={theme.backgroundElement}
        width="100%"
      >
        <box flexDirection="row" paddingLeft={1} paddingRight={1} justifyContent="space-between">
          <text fg={theme.textMuted}>
            {items().length} queued · click to edit · alt+↑ pop last
          </text>
        </box>
        <box flexDirection="column" gap={0} width="100%">
          <For each={items()}>
            {(item, index) => {
              const isSelected = () => selected() === index()
              const displayText = () => {
                const lines = item.text.split("\n").filter(Boolean)
                const firstLine = lines[0] ?? ""
                return firstLine.length > 80 ? firstLine.slice(0, 77) + "..." : firstLine
              }

              return (
                <box
                  flexDirection="row"
                  paddingLeft={1}
                  paddingRight={1}
                  width="100%"
                  backgroundColor={isSelected() ? theme.primary : undefined}
                  onMouseDown={() => {
                    setSelected(index())
                  }}
                  onMouseUp={() => {
                    if (props.sessionID) {
                      void sdk.client.session.queuedRemove({
                        sessionID: props.sessionID,
                        messageID: item.messageID,
                      })
                    }
                    props.onEdit?.(item)
                  }}
                >
                  <text
                    fg={isSelected() ? theme.text : theme.textMuted}
                    flexGrow={1}
                    wrapMode="none"
                  >
                    {`${index() + 1}. `}{displayText()}
                  </text>
                  <box flexDirection="row" gap={1} flexShrink={0}>
                    <box
                      onMouseDown={(e) => {
                        e.stopPropagation()
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation()
                        if (props.sessionID && index() > 0) {
                          void sdk.client.session.queuedReorder({
                            sessionID: props.sessionID,
                            messageID: item.messageID,
                            direction: "up",
                          })
                        }
                        props.onMoveUp?.(index())
                      }}
                    >
                      <text fg={isSelected() ? theme.text : theme.textMuted}>▲</text>
                    </box>
                    <box
                      onMouseDown={(e) => {
                        e.stopPropagation()
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation()
                        if (props.sessionID && index() < items().length - 1) {
                          void sdk.client.session.queuedReorder({
                            sessionID: props.sessionID,
                            messageID: item.messageID,
                            direction: "down",
                          })
                        }
                        props.onMoveDown?.(index())
                      }}
                    >
                      <text fg={isSelected() ? theme.text : theme.textMuted}>▼</text>
                    </box>
                    <box
                      onMouseDown={(e) => {
                        e.stopPropagation()
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation()
                        if (props.sessionID) {
                          void sdk.client.session.queuedRemove({
                            sessionID: props.sessionID,
                            messageID: item.messageID,
                          })
                        }
                        props.onDelete?.(item.messageID)
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
      </box>
    </Show>
  )
}
