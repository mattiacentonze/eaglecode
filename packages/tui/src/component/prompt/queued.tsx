import { TextAttributes } from "@opentui/core"
import { For, Show, createMemo, createSignal } from "solid-js"
import { useSync } from "../../context/sync"
import { useTheme } from "../../context/theme"
import { useSDK } from "../../context/sdk"
import { useCommandShortcut } from "../../keymap"

export type QueuedPromptItem = {
  messageID: string
  text: string
  deferred?: boolean
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
  const interruptShortcut = useCommandShortcut("session.interrupt")
  const interruptKey = createMemo(() => {
    const raw = interruptShortcut()
    if (!raw) return "Esc"
    if (raw.toLowerCase() === "escape" || raw.toLowerCase() === "esc") return "Esc"
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  })

  const items = createMemo<QueuedPromptItem[]>(() => {
    if (!props.sessionID) return []
    return sync.data.queued?.[props.sessionID] ?? []
  })

  const deferredSteers = createMemo(() => items().filter((item) => item.deferred))
  const nonDeferred = createMemo(() => items().filter((item) => !item.deferred))
  const pendingSteers = createMemo(() => (nonDeferred().length > 0 ? [nonDeferred()[0]] : []))
  const queuedFollowups = createMemo(() => (nonDeferred().length > 1 ? nonDeferred().slice(1) : []))

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
        <Show when={pendingSteers().length > 0}>
          <box flexDirection="row" paddingLeft={1} paddingRight={1}>
            <text fg={theme.text}>
              • Messages to be submitted after next tool call{" "}
              <span style={{ fg: theme.textMuted }}>(press {interruptKey()} to interrupt and send immediately)</span>
            </text>
          </box>
          <box flexDirection="column" gap={0} width="100%">
            <For each={pendingSteers()}>
              {(item) => {
                const itemIndex = () => items().findIndex((i) => i.messageID === item.messageID)
                const isSelected = () => selected() === itemIndex()

                return (
                  <box
                    flexDirection="row"
                    paddingLeft={1}
                    paddingRight={1}
                    width="100%"
                    backgroundColor={isSelected() ? theme.primary : undefined}
                    onMouseDown={() => {
                      setSelected(itemIndex())
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
                    <box flexDirection="row" flexGrow={1} gap={0}>
                      <text fg={theme.textMuted}>  ↳ </text>
                      <text fg={theme.textMuted}>{item.text}</text>
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
        </Show>

        <Show when={deferredSteers().length > 0}>
          <Show when={pendingSteers().length > 0}>
            <box height={1} />
          </Show>
          <box flexDirection="row" paddingLeft={1} paddingRight={1}>
            <text fg={theme.text}>• Messages to be submitted at end of turn</text>
          </box>
          <box flexDirection="column" gap={0} width="100%">
            <For each={deferredSteers()}>
              {(item) => {
                const itemIndex = () => items().findIndex((i) => i.messageID === item.messageID)
                const isSelected = () => selected() === itemIndex()

                return (
                  <box
                    flexDirection="row"
                    paddingLeft={1}
                    paddingRight={1}
                    width="100%"
                    backgroundColor={isSelected() ? theme.primary : undefined}
                    onMouseDown={() => {
                      setSelected(itemIndex())
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
                    <box flexDirection="row" flexGrow={1} gap={0}>
                      <text fg={theme.textMuted}>  ↳ </text>
                      <text fg={theme.textMuted}>{item.text}</text>
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
        </Show>

        <Show when={queuedFollowups().length > 0}>
          <Show when={pendingSteers().length > 0 || deferredSteers().length > 0}>
            <box height={1} />
          </Show>
          <box flexDirection="row" paddingLeft={1} paddingRight={1}>
            <text fg={theme.text}>• Queued follow-up inputs</text>
          </box>
          <box flexDirection="column" gap={0} width="100%">
            <For each={queuedFollowups()}>
              {(item) => {
                const itemIndex = () => items().findIndex((i) => i.messageID === item.messageID)
                const isSelected = () => selected() === itemIndex()

                return (
                  <box
                    flexDirection="row"
                    paddingLeft={1}
                    paddingRight={1}
                    width="100%"
                    backgroundColor={isSelected() ? theme.primary : undefined}
                    onMouseDown={() => {
                      setSelected(itemIndex())
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
                    <box flexDirection="row" flexGrow={1} gap={0}>
                      <text fg={theme.textMuted}>  ↳ </text>
                      <text fg={theme.textMuted} attributes={TextAttributes.ITALIC}>
                        {item.text}
                      </text>
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
        </Show>

        <box paddingLeft={1} paddingRight={1}>
          <text fg={theme.textMuted}>    Alt+Up edit last queued message</text>
        </box>
      </box>
    </Show>
  )
}
