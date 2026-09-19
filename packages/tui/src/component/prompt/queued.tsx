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
        <box flexDirection="row" paddingLeft={1} paddingRight={1}>
          <text fg={theme.text}>Messages to be submitted after next tool call </text>
          <text fg={theme.textMuted}>(press esc to interrupt and send immediately)</text>
        </box>
        <box flexDirection="column" gap={0} width="100%">
          <For each={items()}>
            {(item, index) => {
              const isSelected = () => selected() === index()

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
                  <box flexDirection="row" flexGrow={1} gap={1}>
                    <text fg={theme.textMuted}>↳</text>
                    <text fg={theme.text}>{item.text}</text>
                  </box>
                  <box
                    flexShrink={0}
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
                    <text fg={theme.textMuted}>✕</text>
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
