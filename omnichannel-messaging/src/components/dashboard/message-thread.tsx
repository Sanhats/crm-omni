"use client"

import { useState, useEffect, useRef } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { supabaseClient } from "@/lib/supabase/client"
import type { ConversationWithDetails } from "@/types/conversation"
import type { MessageWithSender } from "@/types/message"
import ReplyBox from "./reply-box"

interface MessageThreadProps {
  conversation: ConversationWithDetails | null
  onMarkAsRead: (conversationId: string) => Promise<void>
}

export default function MessageThread({ conversation, onMarkAsRead }: MessageThreadProps) {
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!conversation) return

    const fetchMessages = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data, error } = await supabaseClient
          .from("messages")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true })

        if (error) throw error

        // Enriquecer los mensajes con información del remitente
        const messagesWithSender = data.map((message: any) => {
          let sender

          if (message.sender_type === "contact") {
            sender = {
              name:
                conversation.contact?.name || conversation.contact?.email || conversation.contact?.phone || "Contacto",
              avatar_url: conversation.contact?.profile_pic_url,
            }
          } else if (message.sender_type === "system") {
            sender = {
              name: "Sistema",
              avatar_url: null,
            }
          } else {
            // Aquí se podría obtener la información del agente desde el estado global
            sender = {
              name: "Agente",
              avatar_url: null,
            }
          }

          return {
            ...message,
            sender,
          }
        })

        setMessages(messagesWithSender)

        // Marcar la conversación como leída si tiene mensajes no leídos
        if (conversation.unread_count > 0) {
          await onMarkAsRead(conversation.id)
        }
      } catch (error) {
        console.error("Error fetching messages:", error)
        setError("No se pudieron cargar los mensajes")
      } finally {
        setLoading(false)
        // Desplazar al final de los mensajes
        scrollToBottom()
      }
    }

    fetchMessages()

    // Suscribirse a nuevos mensajes
    const subscription = supabaseClient
      .channel(`messages:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMessage = payload.new as any

          // Añadir información del remitente
          let sender
          if (newMessage.sender_type === "contact") {
            sender = {
              name:
                conversation.contact?.name || conversation.contact?.email || conversation.contact?.phone || "Contacto",
              avatar_url: conversation.contact?.profile_pic_url,
            }
          } else if (newMessage.sender_type === "system") {
            sender = {
              name: "Sistema",
              avatar_url: null,
            }
          } else {
            sender = {
              name: "Agente",
              avatar_url: null,
            }
          }

          setMessages((prev) => [...prev, { ...newMessage, sender }])
          scrollToBottom()
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [conversation, onMarkAsRead])

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 100)
  }

  const handleSendMessage = async (content: string) => {
    if (!conversation || !content.trim()) return

    try {
      const { error } = await supabaseClient.from("messages").insert({
        conversation_id: conversation.id,
        sender_type: "agent",
        sender_id: (await supabaseClient.auth.getUser()).data.user?.id,
        content,
        message_type: "text",
        status: "sent",
        sent_at: new Date().toISOString(),
      })

      if (error) throw error

      // La suscripción se encargará de añadir el mensaje a la lista
    } catch (error) {
      console.error("Error sending message:", error)
      alert("No se pudo enviar el mensaje")
    }
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 border rounded-lg">
        <p className="text-gray-500">Selecciona una conversación para ver los mensajes</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        <p>{error}</p>
        <button className="mt-2 text-indigo-600 hover:text-indigo-800" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    )
  }

  // Agrupar mensajes por fecha
  const groupedMessages: { [date: string]: MessageWithSender[] } = {}

  messages.forEach((message) => {
    const date = new Date(message.created_at).toDateString()
    if (!groupedMessages[date]) {
      groupedMessages[date] = []
    }
    groupedMessages[date].push(message)
  })

  return (
    <div className="flex flex-col h-full bg-white border rounded-lg overflow-hidden">
      <div className="border-b px-4 py-3 flex items-center">
        <div className="flex-shrink-0">
          {conversation.contact?.profile_pic_url ? (
            <img
              className="h-10 w-10 rounded-full"
              src={conversation.contact.profile_pic_url || "/placeholder.svg"}
              alt={conversation.contact.name || "Contact"}
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-indigo-800 font-medium">
                {(conversation.contact?.name || conversation.contact?.email || "U").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium">
            {conversation.contact?.name ||
              conversation.contact?.email ||
              conversation.contact?.phone ||
              "Contacto sin nombre"}
          </p>
          <p className="text-xs text-gray-500">{conversation.channel === "whatsapp" ? "WhatsApp" : "Email"}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.keys(groupedMessages).map((date) => (
          <div key={date}>
            <div className="flex justify-center my-4">
              <span className="px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-500">
                {format(new Date(date), "EEEE, d MMMM", { locale: es })}
              </span>
            </div>

            {groupedMessages[date].map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_type === "contact" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`flex max-w-xs md:max-w-md ${
                    message.sender_type === "contact" ? "flex-row" : "flex-row-reverse"
                  }`}
                >
                  <div className="flex-shrink-0">
                    {message.sender?.avatar_url ? (
                      <img
                        className="h-8 w-8 rounded-full"
                        src={message.sender.avatar_url || "/placeholder.svg"}
                        alt={message.sender.name}
                      />
                    ) : (
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          message.sender_type === "contact"
                            ? "bg-indigo-100 text-indigo-800"
                            : message.sender_type === "system"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-green-100 text-green-800"
                        }`}
                      >
                        <span className="text-xs font-medium">{message.sender?.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>

                  <div
                    className={`mx-2 px-4 py-2 rounded-lg ${
                      message.sender_type === "contact"
                        ? "bg-gray-100 text-gray-800"
                        : message.sender_type === "system"
                          ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                          : "bg-indigo-100 text-indigo-800"
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs text-gray-500 mt-1 text-right">
                      {format(new Date(message.created_at), "HH:mm")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <ReplyBox onSendMessage={handleSendMessage} />
    </div>
  )
}