/**
Участник общения имеет одинаковую публичную идентичность независимо
от backend. Исполнение бота и управление его задачами остаются у backend.

@property id Устойчивая идентичность пользователя в данном backend.
@property kind Человек или бот; не определяет права в беседе.
@property name Отображаемое имя.
@property [avatarUrl] Адрес изображения, предоставленный backend.
*/
export interface User {
  readonly id: string
  readonly kind: 'human' | 'bot'
  readonly name: string
  readonly avatarUrl?: string
}
