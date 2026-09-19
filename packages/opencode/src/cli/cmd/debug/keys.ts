import { cmd } from "../cmd"
import { UI } from "@/cli/ui"

export const KeysCommand = cmd({
  command: "keys",
  describe: "inspect terminal keypresses, raw bytes, and modifier detection",
  handler: async () => {
    if (!process.stdin.isTTY) {
      UI.error("This command requires an interactive TTY terminal.")
      process.exit(1)
    }

    UI.println(UI.logo("  "))
    UI.println("")
    UI.println("EagleCode Terminal Key Inspector")
    UI.println("Press keys to see raw bytes and detection (press 'q' or Ctrl+C to exit):")
    UI.println("----------------------------------------------------------------------")

    process.stdin.setRawMode(true)
    process.stdin.resume()

    // Emit terminal keyboard protocol sequences
    process.stdout.write("\x1b[>4;2m\x1b[>31u")

    const cleanup = () => {
      process.stdout.write("\x1b[>4m\x1b[<u")
      process.stdin.setRawMode(false)
      process.stdin.pause()
      UI.println("\nExiting key inspector.")
      process.exit(0)
    }

    process.stdin.on("data", (chunk: Buffer) => {
      const hex = Array.from(chunk).map((b) => b.toString(16).padStart(2, "0")).join(" ")
      const raw = chunk.toString()
      const isCtrlC = chunk.length === 1 && chunk[0] === 3
      const isQ = chunk.length === 1 && (chunk[0] === 113 || chunk[0] === 81)

      if (isCtrlC || isQ) {
        cleanup()
        return
      }

      let classification = "Other key"
      if (raw === "\r") {
        classification = "Plain Enter (0x0D / \\r) -> SUBMIT"
      } else if (raw === "\n") {
        classification = "Linefeed (0x0A / \\n) -> NEWLINE"
      } else if (raw === "\x1b\r") {
        classification = "Alt+Enter (\\x1b\\r) -> NEWLINE"
      } else if (raw.includes("13;2u") || raw.includes("27;2;13~")) {
        classification = "Shift+Enter (with shift modifier!) -> NEWLINE"
      } else if (raw.includes("13;5u") || raw.includes("27;5;13~")) {
        classification = "Ctrl+Enter (with ctrl modifier!) -> NEWLINE"
      }

      UI.println(`[Raw Bytes]: ${hex} | [Action]: ${classification}`)
    })
  },
})
