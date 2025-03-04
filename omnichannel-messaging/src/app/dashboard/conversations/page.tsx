"use client"

import { useState } from "react"
import { supabaseClient } from "@/lib/supabase/client"
import ConversationList from "@/components/dashboard/conversation-list"
import MessageThread from "@/components/dashboard/message-thread"
import type { ConversationWithDetails } from "@/types/conversation"

export default function ConversationsPage() {
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null)

  const handleSelectConversation = (conversation: ConversationWithDetails) => {
    setSelectedConversation(conversation)
  }

  const handleMarkAsRead = async (conversationId: string) => {
    try {
      // Actualizar la conversación para marcarla como leída
      await supabaseClient.from("conversations").update({ unread_count: 0 }).eq("id", conversationId)
    } catch (error) {
      console.error("Error marking conversation as read:", error)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-6">Conversaciones</h1>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
        <div className="md:col-span-1 border rounded-lg bg-white overflow-hidden">
          <ConversationList
            onSelectConversation={handleSelectConversation}
            selectedConversationId={selectedConversation?.id}
          />
        </div>

        <div className="md:col-span-2">
          <MessageThread conversation={selectedConversation} onMarkAsRead={handleMarkAsRead} />
        </div>
      </div>
    </div>
  )
}

