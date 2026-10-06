import type {ConversationPermissions} from "./permissions"

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
