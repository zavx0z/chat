import type { User } from '@chat/user'
import type { Message } from '@chat-conversation/message'

/**
Backend сообщает допустимые действия текущего пользователя в конкретной
беседе. UI использует сведения для отображения; backend проверяет каждый запрос.

@property send Отправка сообщений и ответов.
@property rename Изменение имени группы.
@property invite Приглашение участника.
@property remove Удаление другого участника.
@property assignAdmin Назначение или снятие администратора.
@property transferOwnership Передача владения группой.
@property leave Выход из группы.
*/
export interface ConversationPermissions {
  readonly send: boolean
  readonly rename: boolean
  readonly invite: boolean
  readonly remove: boolean
  readonly assignAdmin: boolean
  readonly transferOwnership: boolean
  readonly leave: boolean
}

/**
Участие пользователя относится к беседе, из которой оно прочитано.
Права не вычисляются клиентом из роли.

@property userId Пользователь, участвующий в беседе.
@property role В группе один владелец; backend поддерживает инвариант состава.
@property permissions Права данного участника в этой беседе.
*/
export interface Participation {
  readonly userId: string
  readonly role: 'owner' | 'admin' | 'member'
  readonly permissions: ConversationPermissions
}

/**
Личная или групповая беседа в списке и в открытом представлении.

@property id Устойчивая серверная идентичность.
@property kind Личное общение двух пользователей либо группа.
@property title Отображаемое имя, подготовленное backend для текущего пользователя.
@property updatedAt Время последнего изменения в формате ISO 8601.
@property unreadCount Число непрочитанных сообщений для текущего пользователя.
@property lastMessage Последнее подтверждённое сообщение или `null`.
@property participation Участие текущего пользователя либо `null` после выхода.
@property revision Монотонная ревизия данных беседы; старый ответ не заменяет новый.
*/
export interface Conversation {
  readonly id: string
  readonly kind: 'private' | 'group'
  readonly title: string
  readonly updatedAt: string
  readonly unreadCount: number
  readonly lastMessage: Message | null
  readonly participation: Participation | null
  readonly revision: number
}

/**
Страница истории приходит в возрастающем порядке `Message.sequence`.
Курсор непрозрачен для клиента и указывает следующую более старую страницу.

@property messages Подтверждённые сообщения только запрошенной беседы.
@property olderCursor Курсор более старых сообщений или `null` при исчерпании.
*/
export interface MessagePage {
  readonly messages: readonly Message[]
  readonly olderCursor: string | null
}

/**
Идемпотентный запрос отправки. Повтор того же `clientId` у того же автора
возвращает исходное сообщение и не создаёт второе; изменение payload с тем же
ключом backend отклоняет. Ответы ссылаются только на сообщения этой беседы.

@property conversationId Адресат отправки.
@property clientId Ключ сохраняется клиентом между неудачей и retry.
@property text Непустой текст, исходные пробелы сохраняются.
@property replyToId Серверная идентичность сообщения для ответа или `null`.
*/
export interface SendMessageInput {
  readonly conversationId: string
  readonly clientId: string
  readonly text: string
  readonly replyToId: string | null
}

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
