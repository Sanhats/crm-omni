export type MessageType = "text" | "image" | "video" | "document" | "location" | "audio"
export type MessageStatus = "received" | "sent" | "delivered" | "read" | "failed"
export type SenderType = "contact" | "agent" | "system"

export interface Message {
  id: string
  conversation_id: string
  sender_type: SenderType
  sender_id: string | null
  content: string | null
  media_urls: string[] | null
  message_type: MessageType
  status: MessageStatus
  external_id: string | null
  metadata: Record<string, any>
  created_at: string
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
}

export interface MessageWithSender extends Message {
  sender?: {
    name: string
    avatar_url?: string
  }
}

