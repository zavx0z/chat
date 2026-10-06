import type {Participation} from "./participation"
import type {Conversation} from "./conversation"
import type {MessagePage} from "./message-page"
import type {SendMessageInput} from "./send-message"
import type {ConversationEvent} from "./event"
import type {User} from "@zavx0z/chat/user"
import type {Message} from "@zavx0z/chat/message"

/**
Единый обязательный frontend API Artel, Storybook и MetaFor.
Backend владеет авторизацией, хранением, курсорами и доставкой событий.
Ошибки запросов отклоняют Promise; unsupported операции не объявляются optional.
Подписка и её закрытие не создают и не отменяют задачи агентов.

@property getSession Читает пользователя действующей сессии.
@property listConversations Читает доступные беседы текущего пользователя.
@property getConversation Читает беседу вместе с актуальными правами.
@property listMessages Читает историю; `limit` — положительное целое, `before` — курсор backend.
@property listParticipants Читает состав адресованной беседы.
@property listUsers Читает доступных для общения людей и ботов.
@property sendMessage Идемпотентно отправляет сообщение или ответ.
@property markRead Отмечает прочтение до указанного серверного сообщения включительно и возвращает обновлённую беседу.
@property createPrivate Создаёт или возвращает существующую личную беседу с пользователем.
@property createGroup Создаёт группу с заданными участниками; backend добавляет текущего пользователя владельцем.
@property renameConversation Меняет имя группы и возвращает её актуальное состояние.
@property inviteParticipant Приглашает пользователя и возвращает актуальное состояние группы.
@property removeParticipant Удаляет участника и возвращает актуальное состояние группы.
@property setAdministrator Меняет роль участника между admin и member.
@property transferOwnership Атомарно передаёт владение участнику и возвращает состояние группы.
@property leaveConversation Завершает участие текущего пользователя в группе.
@property subscribe Подключает поток; возвращённая функция закрывает только эту подписку.
*/
export interface ChatApi {
  getSession(): Promise<User>
  listConversations(): Promise<readonly Conversation[]>
  getConversation(conversationId: string): Promise<Conversation>
  listMessages(input: { conversationId: string, before?: string, limit: number }): Promise<MessagePage>
  listParticipants(conversationId: string): Promise<readonly Participation[]>
  listUsers(): Promise<readonly User[]>
  sendMessage(input: SendMessageInput): Promise<Message>
  markRead(input: { conversationId: string, messageId: string }): Promise<Conversation>
  createPrivate(input: { userId: string }): Promise<Conversation>
  createGroup(input: { title: string, userIds: readonly string[] }): Promise<Conversation>
  renameConversation(input: { conversationId: string, title: string }): Promise<Conversation>
  inviteParticipant(input: { conversationId: string, userId: string }): Promise<Conversation>
  removeParticipant(input: { conversationId: string, userId: string }): Promise<Conversation>
  setAdministrator(input: { conversationId: string, userId: string, administrator: boolean }): Promise<Conversation>
  transferOwnership(input: { conversationId: string, userId: string }): Promise<Conversation>
  leaveConversation(input: { conversationId: string }): Promise<void>
  subscribe(listener: (event: ConversationEvent) => void): () => void
}
