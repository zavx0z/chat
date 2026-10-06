import type {Participation} from "./participation"
import type {Conversation} from "./conversation"
import type {Message} from "@zavx0z/chat/message"

/**
Поток backend публикует подтверждённые изменения. При восстановлении
соединения клиент повторно читает загруженные беседы и список.

@property type Вид изменения или состояние транспорта.
*/
export type ConversationEvent =
  | { readonly type: 'message', readonly message: Message }
  | { readonly type: 'conversation', readonly conversation: Conversation }
  | { readonly type: 'participants', readonly conversationId: string, readonly participants: readonly Participation[] }
  | { readonly type: 'removed', readonly conversationId: string }
  | { readonly type: 'connection', readonly connected: boolean }
  | { readonly type: 'error', readonly error: Error }
