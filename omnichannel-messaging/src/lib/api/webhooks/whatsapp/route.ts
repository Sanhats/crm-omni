import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

// Crear cliente de Supabase para el servidor
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Método GET para verificación del webhook
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Verificar que sea una solicitud de suscripción y que el token coincida
  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
    console.log('Webhook verificado correctamente!')
    return new NextResponse(challenge)
  } else {
    console.log('Verificación fallida. Token incorrecto.')
    return new NextResponse('Verification failed', { status: 403 })
  }
}

// Método POST para recibir mensajes
export async function POST(request: NextRequest) {
  try {
    // Verificar la firma del webhook (implementación específica de WhatsApp)
    // Esta es una implementación simplificada
    const signature = request.headers.get("x-hub-signature")
    if (!verifySignature(signature, await request.text())) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    // Parsear el cuerpo de la solicitud
    const body = await request.json()

    // Procesar los eventos de WhatsApp
    // Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === "messages") {
            const value = change.value

            // Procesar mensajes entrantes
            if (value.messages && value.messages.length > 0) {
              for (const message of value.messages) {
                await processWhatsAppMessage(message, value.contacts[0])
              }
            }

            // Procesar actualizaciones de estado
            if (value.statuses && value.statuses.length > 0) {
              for (const status of value.statuses) {
                await processWhatsAppStatus(status)
              }
            }
          }
        }
      }

      // Responder con éxito para confirmar recepción
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unsupported event type" }, { status: 400 })
  } catch (error) {
    console.error("Error processing WhatsApp webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Verifica la firma del webhook de WhatsApp
 */
function verifySignature(signature: string | null, body: string): boolean {
  // Implementación real requiere crypto para verificar HMAC
  // Esta es una implementación simplificada para el MVP
  return true
}

/**
 * Procesa un mensaje entrante de WhatsApp
 */
async function processWhatsAppMessage(message: any, contact: any) {
  try {
    // 1. Buscar o crear el contacto
    const { data: contactData, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("external_id", contact.wa_id)
      .eq("channel", "whatsapp")
      .single()

    let contactId: string

    if (contactError || !contactData) {
      // Crear nuevo contacto
      const { data: newContact, error: newContactError } = await supabase
        .from("contacts")
        .insert({
          external_id: contact.wa_id,
          channel: "whatsapp",
          name: contact.profile.name,
          phone: contact.wa_id,
          metadata: { profile: contact.profile },
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
    const { data: conversationData, error: conversationError } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", contactId)
      .eq("status", "open")
      .single()

    let conversationId: string

    if (conversationError || !conversationData) {
      // Crear nueva conversación
      const { data: newConversation, error: newConversationError } = await supabase
        .from("conversations")
        .insert({
          contact_id: contactId,
          channel: "whatsapp",
          status: "open",
          priority: 0,
          last_message_at: new Date().toISOString(),
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

    // 3. Procesar el mensaje según su tipo
    let content: string | null = null
    let mediaUrls: string[] | null = null
    let messageType = "text"

    if (message.text) {
      content = message.text.body
      messageType = "text"
    } else if (message.image) {
      messageType = "image"
      mediaUrls = [message.image.id] // En un sistema real, descargarías la imagen
    } else if (message.video) {
      messageType = "video"
      mediaUrls = [message.video.id]
    } else if (message.document) {
      messageType = "document"
      mediaUrls = [message.document.id]
    } else if (message.location) {
      messageType = "location"
      content = JSON.stringify(message.location)
    } else if (message.audio) {
      messageType = "audio"
      mediaUrls = [message.audio.id]
    }

    // 4. Guardar el mensaje
    const { error: messageError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_type: "contact",
      content,
      media_urls: mediaUrls,
      message_type: messageType,
      external_id: message.id,
      metadata: message,
      status: "received",
    })

    if (messageError) {
      throw new Error(`Error saving message: ${messageError.message}`)
    }

    // 5. Verificar si se debe enviar una respuesta automática
    await checkAndSendAutoReply(conversationId, content)
  } catch (error) {
    console.error("Error processing WhatsApp message:", error)

    // Registrar el evento para reintento
    await supabase.from("sync_events").insert({
      channel: "whatsapp",
      event_type: "message_receive",
      status: "failed",
      payload: { message, contact },
      error_message: (error as Error).message,
      retry_count: 0,
      next_retry_at: new Date(Date.now() + 60000).toISOString(), // Reintento en 1 minuto
    })
  }
}

/**
 * Procesa una actualización de estado de WhatsApp
 */
async function processWhatsAppStatus(status: any) {
  try {
    // Buscar el mensaje por external_id
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("id")
      .eq("external_id", status.id)
      .single()

    if (messageError || !message) {
      console.warn(`Message with external_id ${status.id} not found`)
      return
    }

    // Actualizar el estado del mensaje
    const updateData: any = {}

    if (status.status === "sent") {
      updateData.status = "sent"
      updateData.sent_at = new Date().toISOString()
    } else if (status.status === "delivered") {
      updateData.status = "delivered"
      updateData.delivered_at = new Date().toISOString()
    } else if (status.status === "read") {
      updateData.status = "read"
      updateData.read_at = new Date().toISOString()
    } else if (status.status === "failed") {
      updateData.status = "failed"
    }

    await supabase.from("messages").update(updateData).eq("id", message.id)
  } catch (error) {
    console.error("Error processing WhatsApp status update:", error)
  }
}

/**
 * Verifica si se debe enviar una respuesta automática
 */
async function checkAndSendAutoReply(conversationId: string, content: string | null) {
  if (!content) return

  try {
    // Buscar respuestas automáticas activas
    const { data: autoReplies, error } = await supabase
      .from("auto_replies")
      .select("*")
      .eq("is_active", true)
      .or(`channel.is.null,channel.eq.whatsapp`)

    if (error || !autoReplies || autoReplies.length === 0) return

    // Verificar si el contenido coincide con alguna palabra clave
    for (const reply of autoReplies) {
      const keywords = reply.trigger_keywords
      const contentLower = content.toLowerCase()

      const matches = keywords.some((keyword) => contentLower.includes(keyword.toLowerCase()))

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

        // En un sistema real, aquí enviarías el mensaje a la API de WhatsApp

        break // Solo enviar la primera respuesta que coincida
      }
    }
  } catch (error) {
    console.error("Error checking auto-replies:", error)
  }
}