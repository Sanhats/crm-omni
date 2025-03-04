import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendWhatsAppTextMessage } from "@/lib/services/whatsapp"
import type { Database } from "@/lib/supabase/types"

// Crear cliente de Supabase para el servidor
const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversation_id, content, sender_id } = body

    if (!conversation_id || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log(`Sending message to conversation ${conversation_id}: ${content}`)

    // 1. Obtener detalles de la conversación
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select(`
        *,
        contact:contacts(*)
      `)
      .eq("id", conversation_id)
      .single()

    if (convError || !conversation) {
      console.error("Error fetching conversation:", convError)
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // 2. Guardar el mensaje en la base de datos
    const { data: message, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        sender_type: "agent",
        sender_id,
        content,
        message_type: "text",
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (msgError) {
      console.error("Error saving message:", msgError)
      return NextResponse.json({ error: "Failed to save message" }, { status: 500 })
    }

    // 3. Actualizar la conversación con la fecha del último mensaje
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conversation_id)

    // 4. Enviar el mensaje según el canal
    if (conversation.channel === "whatsapp") {
      const contact = conversation.contact[0]

      if (!contact || !contact.phone) {
        return NextResponse.json({ error: "Contact phone number not found" }, { status: 400 })
      }

      try {
        // Enviar mensaje a WhatsApp
        const whatsappResponse = await sendWhatsAppTextMessage(contact.phone, content)

        // Actualizar el mensaje con el ID externo
        if (whatsappResponse.messages && whatsappResponse.messages[0]?.id) {
          await supabase
            .from("messages")
            .update({
              external_id: whatsappResponse.messages[0].id,
            })
            .eq("id", message.id)
        }

        return NextResponse.json({
          success: true,
          message,
          whatsapp_response: whatsappResponse,
        })
      } catch (whatsappError) {
        console.error("Error sending WhatsApp message:", whatsappError)

        // Actualizar el estado del mensaje a fallido
        await supabase
          .from("messages")
          .update({
            status: "failed",
            metadata: {
              ...message.metadata,
              error: (whatsappError as Error).message,
            },
          })
          .eq("id", message.id)

        return NextResponse.json(
          {
            error: "Failed to send WhatsApp message",
            details: (whatsappError as Error).message,
          },
          { status: 500 },
        )
      }
    } else if (conversation.channel === "email") {
      // Implementación para email (fuera del alcance actual)
      return NextResponse.json({
        success: true,
        message,
        note: "Email sending not implemented yet",
      })
    } else {
      return NextResponse.json({ error: "Unsupported channel" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error in message send API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

