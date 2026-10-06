import type {User} from "@zavx0z/chat/user"

/**
Подтверждённое backend текстовое сообщение принадлежит одной беседе.
`clientId` сохраняется при повторной отправке и позволяет совместить ответ
запроса с тем же сообщением из потока обновлений.

@property id Устойчивая серверная идентичность.
@property clientId Идемпотентный ключ отправки, уникальный у автора в backend.
@property conversationId Беседа, которой принадлежит сообщение.
@property author Снимок автора из backend; имя сохраняется после выхода из группы.
@property text Исходный текст сообщения.
@property replyToId Серверная идентичность сообщения той же беседы или `null`.
@property createdAt Время принятия backend в формате ISO 8601.
@property sequence Строго возрастающий порядок сообщений внутри беседы.
*/
export interface Message {
  readonly id: string
  readonly clientId: string
  readonly conversationId: string
  readonly author: User
  readonly text: string
  readonly replyToId: string | null
  readonly createdAt: string
  readonly sequence: number
}
