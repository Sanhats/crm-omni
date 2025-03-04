import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { v4 as uuidv4 } from "uuid"
import type { Database } from "@/lib/supabase/types"

// Crear cliente de Supabase para el servidor
const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    // Verificar la autenticación del webhook (implementación específica)
    const apiKey = request.headers.get("x-api-key")
    if (apiKey !== process.env.EMAIL_WEBHOOK_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parsear el cuerpo de la solicitud
    const body = await request.json()

    // Procesar el email entrante
    await processIncomingEmail(body)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing email webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Procesa un email entrante
 */
async function processIncomingEmail(emailData: any) {
  try {
    const { from, subject, text, html, attachments = [] } = emailData

    // 1. Buscar o crear el contacto
    const { data: contactData, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", from.email)
      .eq("channel", "email")
      .single()

    let contactId: string

    if (contactError || !contactData) {
      // Crear nuevo contacto
      const { data: newContact, error: newContactError } = await supabase
        .from("contacts")
        .insert({
          channel: "email",
          name: from.name || from.email.split("@")[0],
          email: from.email,
          metadata: { from },
        })
        .select("id")
        .single()

      if (newContactError || !newContact) {
        throw new Error(`Error creating contact: ${newContactError?.message}`)
      }

      contactId = newContact.id
    } else {
      contactId = contactData.id
    }

    // 2. Buscar o crear la conversación
    // Para emails, podemos usar el asunto como agrupador de conversaciones
    const { data: conversationData, error: conversationError } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", contactId)
      .eq("status", "open")
      .eq("metadata->subject", subject)
      .single()

    let conversationId: string

    if (conversationError || !conversationData) {
      // Crear nueva conversación
      const { data: newConversation, error: newConversationError } = await supabase
        .from("conversations")
        .insert({
          contact_id: contactId,
          channel: "email",
          status: "open",
          priority: 0,
          last_message_at: new Date().toISOString(),
          metadata: { subject },
        })
        .select("id")
        .single()

      if (newConversationError || !newConversation) {
        throw new Error(`Error creating conversation: ${newConversationError?.message}`)
      }

      conversationId = newConversation.id
    } else {
      conversationId = conversationData.id
    }

    // 3. Guardar el mensaje
    const content = text || html
    const mediaUrls = attachments.map((attachment: any) => attachment.url || attachment.filename)

    const { error: messageError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_type: "contact",
      content,
      media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      message_type: "text",
      external_id: emailData.messageId || uuidv4(),
      metadata: {
        subject,
        hasAttachments: attachments.length > 0,
        isHtml: !!html,
      },
      status: "received",
    })

    if (messageError) {
      throw new Error(`Error saving message: ${messageError.message}`)
    }

    // 4. Verificar si se debe enviar una respuesta automática
    await checkAndSendAutoReply(conversationId, subject, content)
  } catch (error) {
    console.error("Error processing email:", error)

    // Registrar el evento para reintento
    await supabase.from("sync_events").insert({
      channel: "email",
      event_type: "message_receive",
      status: "failed",
      payload: emailData,
      error_message: (error as Error).message,
      retry_count: 0,
      next_retry_at: new Date(Date.now() + 60000).toISOString(), // Reintento en 1 minuto
    })
  }
}

/**
 * Verifica si se debe enviar una respuesta automática
 */
async function checkAndSendAutoReply(conversationId: string, subject: string, content: string) {
  try {
    // Buscar respuestas automáticas activas
    const { data: autoReplies, error } = await supabase
      .from("auto_replies")
      .select("*")
      .eq("is_active", true)
      .or(`channel.is.null,channel.eq.email`)

    if (error || !autoReplies || autoReplies.length === 0) return

    // Verificar si el contenido o asunto coincide con alguna palabra clave
    const textToCheck = `${subject} ${content}`.toLowerCase()

    for (const reply of autoReplies) {
      const keywords = reply.trigger_keywords

      const matches = keywords.some((keyword) => textToCheck.includes(keyword.toLowerCase()))

      if (matches) {
        // Enviar respuesta automática
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_type: "system",
          content: reply.response_text,
          message_type: "text",
          status: "sent",
          sent_at: new Date().toISOString(),
        })

        // En un sistema real, aquí enviarías el email de respuesta

        break // Solo enviar la primera respuesta que coincida
      }
    }
  } catch (error) {
    console.error("Error checking auto-replies:", error)
  }
}

