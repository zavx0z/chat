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
