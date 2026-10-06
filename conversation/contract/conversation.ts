import type {Participation} from "./participation"
import type {Message} from "@zavx0z/chat/message"

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
