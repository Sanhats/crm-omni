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
  console.log("[WhatsApp Webhook] GET request received for verification")
  
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  
  console.log("[WhatsApp Webhook] Verification params:", { mode, token, challenge })
  console.log("[WhatsApp Webhook] Expected token:", process.env.WHATSAPP_WEBHOOK_SECRET)

  // Verificar que sea una solicitud de suscripción y que el token coincida
  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
    console.log('[WhatsApp Webhook] Verification successful!')
    
    // Registrar evento de verificación exitosa en la base de datos
    try {
      await supabase.from("sync_events").insert({
        channel: "whatsapp",
        event_type: "webhook_verification",
        status: "completed",
        payload: { mode, token, timestamp: new Date().toISOString() },
      })
    } catch (error) {
      console.error("[WhatsApp Webhook] Error logging verification:", error)
    }
    
    return new NextResponse(challenge)
  } else {
    console.log('[WhatsApp Webhook] Verification failed. Token incorrect or invalid mode.')
    
    // Registrar evento de verificación fallida
    try {
      await supabase.from("sync_events").insert({
        channel: "whatsapp",
        event_type: "webhook_verification",
        status: "failed",
        payload: { mode, token, timestamp: new Date().toISOString() },
        error_message: "Token incorrect or invalid mode",
      })
    } catch (error) {
      console.error("[WhatsApp Webhook] Error logging failed verification:", error)
    }
    
    return new NextResponse('Verification failed', { status: 403 })
  }
}

// Método POST para recibir mensajes
export async function POST(request: NextRequest) {
  console.log("[WhatsApp Webhook] POST request received")
  
  try {
    // Clonar el request para poder leerlo múltiples veces
    const clonedRequest = request.clone()
    
    // Leer el cuerpo como texto para logging
    const bodyText = await clonedRequest.text()
    console.log("[WhatsApp Webhook] Request body:", bodyText)
    
    // Registrar el cuerpo del webhook en la base de datos para depuración
    try {
      await supabase.from("sync_events").insert({
        channel: "whatsapp",
        event_type: "webhook_received",
        status: "received",
        payload: JSON.parse(bodyText),
      })
    } catch (error) {
      console.error("[WhatsApp Webhook] Error logging webhook body:", error)
    }
    
    // Parsear el cuerpo como JSON
    const body = JSON.parse(bodyText)

    // Procesar los eventos de WhatsApp
    if (body.object === "whatsapp_business_account") {
      console.log("[WhatsApp Webhook] Processing WhatsApp business account event")
      
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === "messages") {
            const value = change.value
            console.log("[WhatsApp Webhook] Message value:", JSON.stringify(value))

            // Procesar mensajes entrantes
            if (value.messages && value.messages.length > 0) {
              console.log(`[WhatsApp Webhook] Processing ${value.messages.length} messages`)
              
              for (const message of value.messages) {
                console.log("[WhatsApp Webhook] Processing message:", JSON.stringify(message))
                await processWhatsAppMessage(message, value.contacts[0])
              }
            }

            // Procesar actualizaciones de estado
            if (value.statuses && value.statuses.length > 0) {
              console.log(`[WhatsApp Webhook] Processing ${value.statuses.length} status updates`)
              
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

    console.log("[WhatsApp Webhook] Unsupported event type")
    return NextResponse.json({ error: "Unsupported event type" }, { status: 400 })
  } catch (error) {
    console.error("[WhatsApp Webhook] Error processing webhook:", error)
    
    // Registrar el error en la base de datos
    try {
      await supabase.from("sync_events").insert({
        channel: "whatsapp",
        event_type: "webhook_error",
        status: "failed",
        payload: { error: (error as Error).message, stack: (error as Error).stack },
        error_message: (error as Error).message,
      })
    } catch (dbError) {
      console.error("[WhatsApp Webhook] Error logging webhook error:", dbError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Procesa un mensaje entrante de WhatsApp
 */
async function processWhatsAppMessage(message: any, contact: any) {
  console.log("[WhatsApp Webhook] Processing message:", JSON.stringify(message))
  console.log("[WhatsApp Webhook] Contact info:", JSON.stringify(contact))
  
  try {
    // 1. Buscar o crear el contacto
    console.log("[WhatsApp Webhook] Looking for existing contact")
    const { data: contactData, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("external_id", contact.wa_id)
      .eq("channel", "whatsapp")
      .single()

    let contactId: string

    if (contactError || !contactData) {
      console.log("[WhatsApp Webhook] Contact not found, creating new contact")
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
        console.error("[WhatsApp Webhook] Error creating contact:", newContactError)
        throw new Error(`Error creating contact: ${newContactError?.message}`)
      }

      contactId = newContact.id
      console.log("[WhatsApp Webhook] New contact created with ID:", contactId)
    } else {
      contactId = contactData.id
      console.log("[WhatsApp Webhook] Existing contact found with ID:", contactId)
    }

    // 2. Buscar o crear la conversación
    console.log("[WhatsApp Webhook] Looking for existing conversation")
    const { data: conversationData, error: conversationError } = await supabase
      .from("conversations")
      .select("id, unread_count")
      .eq("contact_id", contactId)
      .eq("status", "open")
      .single()

    let conversationId: string
    let unreadCount: number = 0

    if (conversationError || !conversationData) {
      console.log("[WhatsApp Webhook] Conversation not found, creating new conversation")
      // Crear nueva conversación
      const { data: newConversation, error: newConversationError } = await supabase
        .from("conversations")
        .insert({
          contact_id: contactId,
          channel: "whatsapp",
          status: "open",
          priority: 0,
          last_message_at: new Date().toISOString(),
          unread_count: 1, // Iniciar con 1 mensaje no leído
        })
        .select("id")
        .single()

      if (newConversationError || !newConversation) {
        console.error("[WhatsApp Webhook] Error creating conversation:", newConversationError)
        throw new Error(`Error creating conversation: ${newConversationError?.message}`)
      }

      conversationId = newConversation.id
      unreadCount = 1
      console.log("[WhatsApp Webhook] New conversation created with ID:", conversationId)
    } else {
      conversationId = conversationData.id
      unreadCount = conversationData.unread_count + 1
      console.log("[WhatsApp Webhook] Existing conversation found with ID:", conversationId)
    }

    // 3. Procesar el mensaje según su tipo
    let content: string | null = null
    let mediaUrls: string[] | null = null
    let messageType = "text"

    if (message.text) {
      content = message.text.body
      messageType = "text"
      console.log("[WhatsApp Webhook] Processing text message:", content)
    } else if (message.image) {
      messageType = "image"
      mediaUrls = [message.image.id] // En un sistema real, descargarías la imagen
      console.log("[WhatsApp Webhook] Processing image message")
    } else if (message.video) {
      messageType = "video"
      mediaUrls = [message.video.id]
      console.log("[WhatsApp Webhook] Processing video message")
    } else if (message.document) {
      messageType = "document"
      mediaUrls = [message.document.id]
      console.log("[WhatsApp Webhook] Processing document message")
    } else if (message.location) {
      messageType = "location"
      content = JSON.stringify(message.location)
      console.log("[WhatsApp Webhook] Processing location message")
    } else if (message.audio) {
      messageType = "audio"
      mediaUrls = [message.audio.id]
      console.log("[WhatsApp Webhook] Processing audio message")
    }

    // 4. Guardar el mensaje
    console.log("[WhatsApp Webhook] Saving message to database")
    const { data: savedMessage, error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_type: "contact",
        content,
        media_urls: mediaUrls,
        message_type: messageType,
        external_id: message.id,
        metadata: message,
        status: "received",
      })
      .select()
      .single()

    if (messageError) {
      console.error("[WhatsApp Webhook] Error saving message:", messageError)
      throw new Error(`Error saving message: ${messageError.message}`)
    }
    
    console.log("[WhatsApp Webhook] Message saved successfully:", savedMessage)

    // 5. Actualizar la conversación con el último mensaje y aumentar el contador de no leídos
    console.log("[WhatsApp Webhook] Updating conversation with last message")
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: unreadCount,
      })
      .eq("id", conversationId)
      
    if (updateError) {
      console.error("[WhatsApp Webhook] Error updating conversation:", updateError)
    }

    // 6. Verificar si se debe enviar una respuesta automática
    await checkAndSendAutoReply(conversationId, content)
    
    console.log("[WhatsApp Webhook] Message processing completed successfully")
  } catch (error) {
    console.error("[WhatsApp Webhook] Error processing WhatsApp message:", error)

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
  console.log("[WhatsApp Webhook] Processing status update:", JSON.stringify(status))
  
  try {
    // Buscar el mensaje por external_id
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("id")
      .eq("external_id", status.id)
      .single()

    if (messageError || !message) {
      console.warn(`[WhatsApp Webhook] Message with external_id ${status.id} not found`)
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
    console.log(`[WhatsApp Webhook] Message status updated to ${status.status}`)
  } catch (error) {
    console.error("[WhatsApp Webhook] Error processing status update:", error)
  }
}

/**
 * Verifica si se debe enviar una respuesta automática
 */
async function checkAndSendAutoReply(conversationId: string, content: string | null) {
  if (!content) return
  console.log("[WhatsApp Webhook] Checking for auto-replies for content:", content)

  try {
    // Buscar respuestas automáticas activas
    const { data: autoReplies, error } = await supabase
      .from("auto_replies")
      .select("*")
      .eq("is_active", true)
      .or(`channel.is.null,channel.eq.whatsapp`)

    if (error || !autoReplies || autoReplies.length === 0) {
      console.log("[WhatsApp Webhook] No active auto-replies found")
      return
    }

    console.log(`[WhatsApp Webhook] Found ${autoReplies.length} active auto-replies`)

    // Verificar si el contenido coincide con alguna palabra clave
    for (const reply of autoReplies) {
      const keywords = reply.trigger_keywords
      const contentLower = content.toLowerCase()

      const matches = keywords.some((keyword) => contentLower.includes(keyword.toLowerCase()))

      if (matches) {
        console.log(`[WhatsApp Webhook] Auto-reply match found for keyword in: ${reply.name}`)
        
        // Enviar respuesta automática
        const { data: autoReplyMessage, error: replyError } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_type: "system",
            content: reply.response_text,
            message_type: "text",
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (replyError) {
          console.error("[WhatsApp Webhook] Error saving auto-reply message:", replyError)
        } else {
          console.log("[WhatsApp Webhook] Auto-reply message saved:", autoReplyMessage)
        }

        // En un sistema real, aquí enviarías el mensaje a la API de WhatsApp

        break // Solo enviar la primera respuesta que coincida
      }
    }
  } catch (error) {
    console.error("[WhatsApp Webhook] Error checking auto-replies:", error)
  }
}