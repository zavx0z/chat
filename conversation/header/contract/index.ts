/** Имя выбранной беседы и подтверждаемое backend переименование. */
export declare namespace ChatConversationHeader {
  type Input = Readonly<{
    id: string
    title: string
    busy?: boolean | undefined
    onRename(title: string): void | Promise<void>
  }>
}
