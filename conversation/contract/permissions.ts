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
