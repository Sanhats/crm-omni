export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name: string
          avatar_url?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          external_id: string | null
          channel: string
          name: string | null
          phone: string | null
          email: string | null
          profile_pic_url: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          external_id?: string | null
          channel: string
          name?: string | null
          phone?: string | null
          email?: string | null
          profile_pic_url?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          external_id?: string | null
          channel?: string
          name?: string | null
          phone?: string | null
          email?: string | null
          profile_pic_url?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          contact_id: string
          assigned_agent_id: string | null
          status: string
          priority: number
          last_message_at: string
          channel: string
          unread_count: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          assigned_agent_id?: string | null
          status?: string
          priority?: number
          last_message_at?: string
          channel: string
          unread_count?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          assigned_agent_id?: string | null
          status?: string
          priority?: number
          last_message_at?: string
          channel?: string
          unread_count?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_type: string
          sender_id: string | null
          content: string | null
          media_urls: string[] | null
          message_type: string
          status: string
          external_id: string | null
          metadata: Json
          created_at: string
          sent_at: string | null
          delivered_at: string | null
          read_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_type: string
          sender_id?: string | null
          content?: string | null
          media_urls?: string[] | null
          message_type: string
          status?: string
          external_id?: string | null
          metadata?: Json
          created_at?: string
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_type?: string
          sender_id?: string | null
          content?: string | null
          media_urls?: string[] | null
          message_type?: string
          status?: string
          external_id?: string | null
          metadata?: Json
          created_at?: string
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
        }
      }
      auto_replies: {
        Row: {
          id: string
          name: string
          trigger_keywords: string[]
          response_text: string
          is_active: boolean
          channel: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          trigger_keywords: string[]
          response_text: string
          is_active?: boolean
          channel?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          trigger_keywords?: string[]
          response_text?: string
          is_active?: boolean
          channel?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sync_events: {
        Row: {
          id: string
          channel: string
          event_type: string
          status: string
          payload: Json
          error_message: string | null
          retry_count: number
          next_retry_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          channel: string
          event_type: string
          status?: string
          payload: Json
          error_message?: string | null
          retry_count?: number
          next_retry_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          channel?: string
          event_type?: string
          status?: string
          payload?: Json
          error_message?: string | null
          retry_count?: number
          next_retry_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

