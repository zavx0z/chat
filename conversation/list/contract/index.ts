/** Список имён бесед, независимо от пользователей, ботов и их организации. */
export declare namespace ChatConversationList {
  type Input = Readonly<{
    items: readonly Readonly<{id: string, title: string}>[]
    /** Корзина раскрывается отдельно; загрузкой и сохранением управляет потребитель. */
    deletedItems?: readonly Readonly<{id: string, title: string, recoverable?: boolean}>[] | undefined
    trashOpen?: boolean | undefined
    onTrashToggle?(value: boolean): void
    onRestore?(id: string): void | Promise<void>
    /** Вызывается только после отдельного подтверждения внутри управляемого интерфейса. */
    onPurge?(id: string): void | Promise<void>
    selectedId?: string | undefined
    busy?: boolean | undefined
    onSelect(id: string): void
    onCreate(): void | Promise<void>
    onRename(id: string, title: string): void | Promise<void>
    onDelete(id: string): void | Promise<void>
  }>
}
