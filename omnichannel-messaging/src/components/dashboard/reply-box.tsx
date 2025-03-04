"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { PaperAirplaneIcon } from "@heroicons/react/24/solid"
import { supabaseClient } from "@/lib/supabase/client"

interface ReplyBoxProps {
  conversationId: string
}

export default function ReplyBox({ conversationId }: ReplyBoxProps) {
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Ajustar la altura del textarea automáticamente
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim() || sending) return

    try {
      setSending(true)
      setError(null)

      // Obtener el ID del usuario actual
      const {
        data: { user },
      } = await supabaseClient.auth.getUser()

      if (!user) {
        throw new Error("Usuario no autenticado")
      }

      // Enviar el mensaje a través de la API
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: message.trim(),
          sender_id: user.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al enviar el mensaje")
      }

      // Limpiar el mensaje después de enviarlo
      setMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
      setError((error as Error).message)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enviar con Enter (sin Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="border-t p-4">
      {error && <div className="mb-2 p-2 text-sm text-red-600 bg-red-50 rounded">Error: {error}</div>}

      <form onSubmit={handleSubmit} className="flex items-end">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          className="flex-1 resize-none border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          rows={1}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!message.trim() || sending}
          className="ml-2 p-2 rounded-full bg-indigo-600 text-white disabled:bg-indigo-300 disabled:cursor-not-allowed"
        >
          <PaperAirplaneIcon className="h-5 w-5" />
        </button>
      </form>

      {sending && <div className="mt-2 text-xs text-gray-500">Enviando mensaje...</div>}
    </div>
  )
}

