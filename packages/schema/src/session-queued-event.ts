export * as SessionQueuedEvent from "./session-queued-event"

import { Schema } from "effect"
import { Event } from "./event"
import { SessionID } from "./session-id"

export const QueuedPrompt = Schema.Struct({
  messageID: Schema.String,
  text: Schema.String,
  deferred: Schema.optional(Schema.Boolean),
})
export type QueuedPrompt = Schema.Schema.Type<typeof QueuedPrompt>

export const Queued = Event.define({
  type: "session.queued",
  schema: {
    sessionID: SessionID,
    prompts: Schema.Array(QueuedPrompt),
  },
})

export const Definitions = Event.inventory(Queued)
