import type {Message} from "@zavx0z/chat/message"

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
