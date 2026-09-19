import { RGBA } from "@opentui/core"
import type { JSX } from "solid-js"

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#D97757",
  openai: "#10A37F",
  google: "#4285F4",
  deepseek: "#4D6BFE",
  groq: "#F55036",
  mistral: "#F54E00",
  cohere: "#39594D",
  ollama: "#EDEDED",
  xai: "#FFFFFF",
  amazon: "#FF9900",
  bedrock: "#FF9900",
  cloudflare: "#F38020",
  azure: "#0078D4",
}

export function getProviderColorHex(providerID: string): string | undefined {
  const normalized = providerID.toLowerCase()
  return PROVIDER_COLORS[normalized]
}

export function getProviderColor(providerID: string, fallback?: RGBA): RGBA | undefined {
  const hex = getProviderColorHex(providerID)
  if (hex) {
    return RGBA.fromHex(hex)
  }
  return fallback
}

export function getProviderGutter(providerID: string, fallback?: RGBA): () => JSX.Element {
  return () => {
    const color = getProviderColor(providerID, fallback)
    return <text fg={color}>●</text>
  }
}
