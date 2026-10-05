/** Список имён бесед, независимо от пользователей, ботов и их организации. */
export declare namespace ChatConversationList {
  type Input = Readonly<{
    items: readonly Readonly<{id: string, title: string}>[]
    selectedId?: string | undefined
    busy?: boolean | undefined
    onSelect(id: string): void
    onCreate(): void | Promise<void>
    onRename(id: string, title: string): void | Promise<void>
    onDelete(id: string): void | Promise<void>
  }>
}
