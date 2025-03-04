export type ConversationStatus = "open" | "closed" | "pending"

export interface Conversation {
  id: string
  contact_id: string
  assigned_agent_id: string | null
  status: ConversationStatus
  priority: number
  last_message_at: string
  channel: string
  unread_count: number
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ConversationWithDetails extends Conversation {
  contact: {
    id: string
    name: string | null
    phone: string | null
    email: string | null
    profile_pic_url: string | null
  }
  last_message?: {
    content: string | null
    message_type: string
    created_at: string
  }
}

