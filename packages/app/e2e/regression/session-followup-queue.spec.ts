import { base64Encode } from "@opencode-ai/core/util/encode"
import { expect, test, type Page } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"
import { installSseTransport } from "../utils/sse-transport"
import { expectSessionTitle } from "../utils/waits"

const directory = "C:/OpenCode/FollowupQueue"
const projectID = "proj_followup_queue"
const sessionID = "ses_followup_queue"
const title = "Follow-up queue"

test("queues, reorders, edits, removes, and delivers follow-ups in FIFO order", async ({ page }) => {
  const statuses: Record<string, { type: "busy" | "idle" }> = { [sessionID]: { type: "busy" } }
  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "followup-queue",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: { "claude-opus-4-6": { id: "claude-opus-4-6", name: "Claude Opus 4.6", limit: { context: 200_000 } } },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "claude-opus-4-6" },
    },
    sessions: [
      {
        id: sessionID,
        slug: "followup-queue",
        projectID,
        directory,
        title,
        version: "dev",
        time: { created: 1700000000000, updated: 1700000000000 },
      },
    ],
    sessionStatus: () => statuses,
    pageMessages: () => ({ items: [] }),
  })
  const transport = await installSseTransport(page, {
    server: `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`,
  })
  await configurePage(page)

  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await transport.waitForConnection()
  await expectSessionTitle(page, title)

  const composer = page.locator('[data-component="prompt-input-v2"]')
  const input = composer.locator('[data-component="prompt-input"]')
  const dock = page.locator('[data-component="session-followup-dock"]')

  await input.fill("send immediately")
  await page.keyboard.press("Control+Enter")
  await expect(page.getByText("send immediately", { exact: true })).toBeVisible()
  await expect(dock).toHaveCount(0)

  await queue(input, page, "first queued")
  await queue(input, page, "second queued")
  await queue(input, page, "third queued")
  await expect(dock).toBeVisible()
  expect(await queueTexts(dock)).toEqual(["first queued", "second queued", "third queued"])

  const third = queueRow(dock, "third queued")
  await third.getByRole("button", { name: "Previous message" }).click()
  expect(await queueTexts(dock)).toEqual(["first queued", "third queued", "second queued"])

  await third.getByRole("button", { name: "Edit" }).click()
  await expect(input).toHaveText("third queued")
  await input.fill("third edited")
  await page.keyboard.press("Enter")
  expect(await queueTexts(dock)).toEqual(["first queued", "second queued", "third edited"])

  await queueRow(dock, "third edited").getByRole("button", { name: "Delete" }).click()
  expect(await queueTexts(dock)).toEqual(["first queued", "second queued"])

  await page.screenshot({ path: "e2e/test-results/session-followup-queue.png", fullPage: true })

  statuses[sessionID] = { type: "idle" }
  await transport.send(statusEvent("idle"))
  await expect.poll(() => queueTexts(dock)).toEqual(["second queued"])

  statuses[sessionID] = { type: "idle" }
  await transport.send(statusEvent("idle"))
  await expect(dock).toHaveCount(0)
})

async function queue(input: ReturnType<Page["locator"]>, page: Page, text: string) {
  await input.fill(text)
  await page.keyboard.press("Enter")
  await expect(input).toHaveText("")
}

function queueRow(dock: ReturnType<Page["locator"]>, text: string) {
  return dock.getByText(text, { exact: true }).locator("..")
}

async function queueTexts(dock: ReturnType<Page["locator"]>) {
  return dock.locator('[class*="flex-wrap"] > span').allTextContents()
}

function statusEvent(type: "busy" | "idle") {
  return {
    directory,
    payload: { type: "session.status", properties: { sessionID, status: { type } } },
  }
}

async function configurePage(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { followup: "queue", newLayoutDesigns: true } }))
  })
}
