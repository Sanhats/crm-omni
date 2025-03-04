"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { supabaseClient } from "@/lib/supabase/client"
import type { ConversationWithDetails } from "@/types/conversation"

interface ConversationListProps {
  onSelectConversation: (conversation: ConversationWithDetails) => void
  selectedConversationId?: string
}

export default function ConversationList({ onSelectConversation, selectedConversationId }: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true)

        // Obtener conversaciones con detalles del contacto y último mensaje
        const { data, error } = await supabaseClient
          .from("conversations")
          .select(`
            *,
            contact:contacts(id, name, phone, email, profile_pic_url),
            messages:messages(content, message_type, created_at)
          `)
          .eq("status", "open")
          .order("last_message_at", { ascending: false })

        if (error) throw error

        // Transformar los datos para incluir el último mensaje
        const conversationsWithDetails = data.map((conv: any) => {
          // Ordenar mensajes por fecha y obtener el último
          const messages = conv.messages || []
          messages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

          return {
            ...conv,
            contact: conv.contact[0] || null,
            last_message: messages[0] || null,
          }
        })

        setConversations(conversationsWithDetails)
      } catch (error) {
        console.error("Error fetching conversations:", error)
        setError("No se pudieron cargar las conversaciones")
      } finally {
        setLoading(false)
      }
    }

    fetchConversations()

    // Suscribirse a cambios en las conversaciones
    const subscription = supabaseClient
      .channel("public:conversations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          fetchConversations()
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Función para formatear la fecha del último mensaje
  const formatLastMessageTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()

    // Si es hoy, mostrar la hora
    if (date.toDateString() === now.toDateString()) {
      return format(date, "HH:mm")
    }

    // Si es en los últimos 7 días, mostrar el día de la semana
    if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return format(date, "EEEE", { locale: es })
    }

    // Si es más antiguo, mostrar la fecha
    return format(date, "dd/MM/yyyy")
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

  return (
    <div className="overflow-y-auto h-full">
      <h2 className="text-lg font-semibold mb-4 px-4">Conversaciones</h2>

      {conversations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No hay conversaciones activas</div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {conversations.map((conversation) => (
            <li
              key={conversation.id}
              className={`hover:bg-gray-50 cursor-pointer ${
                selectedConversationId === conversation.id ? "bg-indigo-50" : ""
              }`}
              onClick={() => onSelectConversation(conversation)}
            >
              <div className="flex px-4 py-4 sm:px-6">
                <div className="min-w-0 flex-1 flex items-center">
                  <div className="flex-shrink-0">
                    {conversation.contact?.profile_pic_url ? (
                      <img
                        className="h-12 w-12 rounded-full"
                        src={conversation.contact.profile_pic_url || "/placeholder.svg"}
                        alt={conversation.contact.name || "Contact"}
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-indigo-800 font-medium text-lg">
                          {(conversation.contact?.name || conversation.contact?.email || "U").charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 px-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-indigo-600 truncate">
                        {conversation.contact?.name ||
                          conversation.contact?.email ||
                          conversation.contact?.phone ||
                          "Contacto sin nombre"}
                      </p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className="text-xs text-gray-500">
                          {conversation.last_message_at
                            ? formatLastMessageTime(conversation.last_message_at)
                            : "Sin mensajes"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center">
                      <p className="text-sm text-gray-600 truncate">
                        {conversation.last_message?.content || "Sin mensajes"}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          conversation.channel === "whatsapp"
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {conversation.channel === "whatsapp" ? "WhatsApp" : "Email"}
                      </span>

                      {conversation.unread_count > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-indigo-600 rounded-full">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

