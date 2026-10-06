/** Блоки UI не принадлежат wire protocol: лишняя metadata остаётся у backend/host. */
export type MessageContent =
  | Readonly<{type: "text", text: string}>
  | Readonly<{type: "image" | "audio", data: string, mimeType: string}>
  | Readonly<{type: "resource_link", uri: string, name: string, title?: string | null, description?: string | null, mimeType?: string | null, size?: number | null, _meta?: Record<string, unknown> | null}>
  | Readonly<{type: "resource", resource: Readonly<{uri: string, mimeType?: string | null} & ({text: string} | {blob: string})>}>
