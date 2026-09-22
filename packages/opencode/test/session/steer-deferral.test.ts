import { describe, expect, test } from "bun:test"
import { Effect, Fiber, Layer, Scope } from "effect"
import { Runner } from "../../src/effect/runner"
import { SessionPrompt } from "../../src/session/prompt"
import { SessionRunState } from "../../src/session/run-state"
import { Session } from "@/session/session"
import { SessionStatus } from "../../src/session/status"
import { MessageID, SessionID } from "../../src/session/schema"
import { testEffect } from "../lib/effect"
import { reply, TestLLMServer } from "../lib/llm-server"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { MessageV2 } from "../../src/session/message-v2"
import { Snapshot } from "../../src/snapshot"
import { LLM } from "../../src/session/llm"
import { Env } from "../../src/env"
import { Agent as AgentSvc } from "../../src/agent/agent"
import { Command } from "../../src/command"
import { Permission } from "../../src/permission"
import { Plugin } from "../../src/plugin"
import { Config } from "@/config/config"
import { Provider as ProviderSvc } from "@/provider/provider"
import { LSP } from "@/lsp/lsp"
import { MCP } from "../../src/mcp"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { BackgroundJob } from "@/background/job"
import { Database } from "@opencode-ai/core/database/database"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Question } from "../../src/question"
import { Todo } from "../../src/session/todo"
import { ToolRegistry } from "@/tool/registry"
import { Skill } from "../../src/skill"
import { Git } from "../../src/git"
import { Ripgrep } from "@opencode-ai/core/ripgrep"
import { Format } from "../../src/format"
import { Truncate } from "@/tool/truncate"
import { SessionProcessor } from "../../src/session/processor"
import { Image } from "../../src/image/image"
import { SessionCompaction } from "../../src/session/compaction"
import { SessionRevert } from "../../src/session/revert"
import { Instruction } from "../../src/session/instruction"
import { SystemPrompt } from "../../src/session/system"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { SessionSummary } from "../../src/session/summary"
import { TestInstance } from "../fixture/fixture"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import path from "path"

// Test 1: Direct Runner phase state unit tests
describe("Runner phase signal", () => {
  test("runner initializes in idle phase", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const scope = yield* Scope.Scope
        const runner = Runner.make<void>(scope)
        expect(runner.phase).toBe("idle")
      }).pipe(Effect.scoped),
    )
  })

  test("runner transitions phase to generating on startRun and idle on exit", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const scope = yield* Scope.Scope
        const runner = Runner.make<string>(scope)
        expect(runner.phase).toBe("idle")

        const runEffect = Effect.gen(function* () {
          expect(runner.phase).toBe("generating")
          yield* Effect.sleep(20)
          return "done"
        })

        const fiber = yield* runner.ensureRunning(runEffect).pipe(Effect.forkChild)
        yield* Effect.sleep(5)
        expect(runner.phase).toBe("generating")

        yield* runner.setPhase("betweenTurns")
        expect(runner.phase).toBe("betweenTurns")

        const result = yield* Fiber.join(fiber)
        expect(result).toBe("done")
        expect(runner.phase).toBe("idle")
      }).pipe(Effect.scoped),
    )
  })

  test("runner transitions phase to idle on cancel", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const scope = yield* Scope.Scope
        const runner = Runner.make<void>(scope)
        const hang = Effect.never
        const fiber = yield* runner.ensureRunning(hang).pipe(Effect.forkChild)
        yield* Effect.sleep(5)
        expect(runner.phase).toBe("generating")

        yield* runner.cancel
        expect(runner.phase).toBe("idle")
        yield* Fiber.interrupt(fiber)
      }).pipe(Effect.scoped),
    )
  })
})

// Test 2: SessionRunState and SessionPrompt steerQueued deferral behavior
const summary = Layer.succeed(
  SessionSummary.Service,
  SessionSummary.Service.of({
    summarize: () => Effect.void,
    diff: () => Effect.succeed([]),
    computeDiff: () => Effect.succeed([]),
  }),
)

const lsp = Layer.succeed(
  LSP.Service,
  LSP.Service.of({
    init: () => Effect.void,
    status: () => Effect.succeed([]),
    hasClients: () => Effect.succeed(false),
    touchFile: () => Effect.void,
    diagnostics: () => Effect.succeed({}),
    hover: () => Effect.succeed(undefined),
    definition: () => Effect.succeed([]),
    references: () => Effect.succeed([]),
    implementation: () => Effect.succeed([]),
    documentSymbol: () => Effect.succeed([]),
    workspaceSymbol: () => Effect.succeed([]),
    prepareCallHierarchy: () => Effect.succeed([]),
    incomingCalls: () => Effect.succeed([]),
    outgoingCalls: () => Effect.succeed([]),
  }),
)

const mcp = Layer.succeed(
  MCP.Service,
  MCP.Service.of({
    status: () => Effect.succeed({}),
    clients: () => Effect.succeed({}),
    instructions: () => Effect.succeed([]),
    tools: () => Effect.succeed({}),
    prompts: () => Effect.succeed({}),
    resources: () => Effect.succeed({}),
    resourceTemplates: () => Effect.succeed({}),
    add: () => Effect.succeed({ status: { status: "disabled" as const } }),
    connect: () => Effect.void,
    disconnect: () => Effect.void,
    getPrompt: () => Effect.succeed(undefined),
    readResource: () => Effect.succeed(undefined),
    startAuth: () => Effect.die("unexpected MCP auth"),
    authenticate: () => Effect.die("unexpected MCP auth"),
    finishAuth: () => Effect.die("unexpected MCP auth"),
    removeAuth: () => Effect.void,
    supportsOAuth: () => Effect.succeed(false),
    hasStoredTokens: () => Effect.succeed(false),
    getAuthStatus: () => Effect.succeed("not_authenticated" as const),
  }),
)

const runtimeFlags = RuntimeFlags.layer({ experimentalEventSystem: true })
const testLLMServerNode = LayerNode.make({ service: TestLLMServer, layer: TestLLMServer.layer, deps: [] })

const promptRoot = LayerNode.group([
  SessionPrompt.node,
  Session.node,
  SessionProjector.node,
  MessageV2.node,
  Snapshot.node,
  LLM.node,
  Env.node,
  AgentSvc.node,
  Command.node,
  Permission.node,
  Plugin.node,
  Config.node,
  ProviderSvc.node,
  LSP.node,
  MCP.node,
  FSUtil.node,
  BackgroundJob.node,
  SessionStatus.node,
  SessionRunState.node,
  Database.node,
  EventV2Bridge.node,
  Question.node,
  Todo.node,
  ToolRegistry.node,
  Skill.node,
  Git.node,
  Ripgrep.node,
  Format.node,
  Truncate.node,
  SessionProcessor.node,
  Image.node,
  SessionCompaction.node,
  SessionRevert.node,
  Instruction.node,
  SystemPrompt.node,
  CrossSpawnSpawner.node,
  RuntimeFlags.node,
])

function makeHttp() {
  const root = LayerNode.group([promptRoot, testLLMServerNode])
  const replacements = [
    [SessionSummary.node, summary],
    [LSP.node, lsp],
    [MCP.node, mcp],
    [RuntimeFlags.node, runtimeFlags],
  ] as const
  return LayerNode.compile(root, replacements)
}

const it = testEffect(makeHttp())

const cfg = {
  provider: {
    test: {
      name: "Test",
      id: "test",
      env: [],
      npm: "@ai-sdk/openai-compatible",
      models: {
        "test-model": {
          id: "test-model",
          name: "Test Model",
          attachment: false,
          reasoning: false,
          temperature: false,
          tool_call: true,
          release_date: "2025-01-01",
          limit: { context: 100000, output: 10000 },
          cost: { input: 0, output: 0 },
          options: {},
        },
      },
      options: {
        apiKey: "test-key",
        baseURL: "http://localhost:1/v1",
      },
    },
  },
}

function providerCfg(url: string) {
  return {
    ...cfg,
    provider: {
      ...cfg.provider,
      test: {
        ...cfg.provider.test,
        options: {
          ...cfg.provider.test.options,
          baseURL: url,
        },
      },
    },
  }
}

const ref = {
  providerID: ProviderV2.ID.make("test"),
  modelID: ModelV2.ID.make("test-model"),
}

const writeText = Effect.fn("test.writeText")(function* (file: string, text: string) {
  const fs = yield* FSUtil.Service
  yield* fs.writeWithDirs(file, text)
})

const writeConfig = Effect.fn("test.writeConfig")(function* (dir: string, config: any) {
  yield* writeText(
    path.join(dir, "opencode.json"),
    JSON.stringify({ $schema: "https://opencode.ai/config.json", ...config }),
  )
})

const useServerConfig = Effect.fn("test.useServerConfig")(function* (config: (url: string) => any) {
  const { directory: dir } = yield* TestInstance
  const llm = yield* TestLLMServer
  yield* writeConfig(dir, config(llm.url))
  return { dir, llm }
})

describe("SessionPrompt steerQueued deferral behavior", () => {
  it.instance("defers steer when phase is generating, injects when phase is betweenTurns or idle", () =>
    Effect.gen(function* () {
      const { llm } = yield* useServerConfig(providerCfg)
      const prompt = yield* SessionPrompt.Service
      const sessions = yield* Session.Service
      const runState = yield* SessionRunState.Service
      const chat = yield* sessions.create({ title: "Steer Deferral Test" })

      // Initially phase should be idle
      expect(yield* runState.phase(chat.id)).toBe("idle")

      // Simulate a running turn using llm.hang
      yield* llm.hang

      const firstFiber = yield* prompt
        .prompt({
          sessionID: chat.id,
          agent: "build",
          model: ref,
          parts: [{ type: "text", text: "first message" }],
        })
        .pipe(Effect.forkChild)

      yield* llm.wait(1)

      // The runner is now active and in generating phase
      const phaseDuringRun = yield* runState.phase(chat.id)
      expect(phaseDuringRun).toBe("generating")

      // Now enqueue a prompt (force: false) while session is busy
      const queuedMessageID = MessageID.ascending()
      yield* prompt.prompt({
        sessionID: chat.id,
        messageID: queuedMessageID,
        agent: "build",
        model: ref,
        force: false,
        parts: [{ type: "text", text: "queued steer prompt" }],
      })

      // Queue should have 1 item, not deferred yet
      let queued = yield* prompt.getQueued(chat.id)
      expect(queued).toHaveLength(1)
      expect(queued[0].deferred).toBeFalsy()

      // Call steerQueued while phase is "generating"
      yield* prompt.steerQueued(chat.id)

      // It should NOT have injected / cancelled; instead it should be marked deferred!
      queued = yield* prompt.getQueued(chat.id)
      expect(queued).toHaveLength(1)
      expect(queued[0].deferred).toBe(true)
      // The session should still be generating
      expect(yield* runState.phase(chat.id)).toBe("generating")

      // Now simulate phase transitioning to "betweenTurns"
      yield* runState.setPhase(chat.id, "betweenTurns")
      expect(yield* runState.phase(chat.id)).toBe("betweenTurns")

      // Now call steerQueued while phase is "betweenTurns"
      // It should inject immediately (dequeue, cancel current run, and force prompt)
      yield* prompt.steerQueued(chat.id)

      // The queue should now be empty!
      queued = yield* prompt.getQueued(chat.id)
      expect(queued).toHaveLength(0)

      // Cancel session to clean up
      yield* prompt.cancel(chat.id)
      yield* Fiber.interrupt(firstFiber)
    }),
  )
})
