import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calculateNextRetryTime } from "@/lib/utils/retry"
import type { Database } from "@/lib/supabase/types"

// Crear cliente de Supabase para el servidor
const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Número máximo de reintentos
const MAX_RETRIES = 5

export async function GET(request: NextRequest) {
  try {
    // Verificar la autenticación del cron job
    const apiKey = request.headers.get("x-api-key")
    if (apiKey !== process.env.CRON_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Procesar eventos pendientes
    const processedCount = await processPendingEvents()

    return NextResponse.json({ success: true, processedCount })
  } catch (error) {
    console.error("Error processing sync events:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Procesa eventos pendientes de sincronización
 */
async function processPendingEvents() {
  // Obtener eventos pendientes que están listos para ser procesados
  const { data: events, error } = await supabase
    .from("sync_events")
    .select("*")
    .eq("status", "pending")
    .lt("next_retry_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(50) // Procesar en lotes para evitar sobrecarga

  if (error || !events || events.length === 0) {
    return 0
  }

  let processedCount = 0

  for (const event of events) {
    try {
      // Marcar el evento como en procesamiento
      await supabase.from("sync_events").update({ status: "processing" }).eq("id", event.id)

      // Procesar el evento según su tipo y canal
      let success = false

      if (event.channel === "whatsapp") {
        if (event.event_type === "message_receive") {
          // Reintentar procesamiento de mensaje de WhatsApp
          // Implementación real llamaría a processWhatsAppMessage
          success = true
        } else if (event.event_type === "message_send") {
          // Reintentar envío de mensaje a WhatsApp
          // Implementación real llamaría a la API de WhatsApp
          success = true
        }
      } else if (event.channel === "email") {
        if (event.event_type === "message_receive") {
          // Reintentar procesamiento de email
          // Implementación real llamaría a processIncomingEmail
          success = true
        } else if (event.event_type === "message_send") {
          // Reintentar envío de email
          // Implementación real llamaría a la API de email
          success = true
        }
      }

      if (success) {
        // Marcar el evento como completado
        await supabase.from("sync_events").update({ status: "completed" }).eq("id", event.id)

        processedCount++
      } else {
        // Incrementar contador de reintentos
        const retryCount = event.retry_count + 1

        if (retryCount >= MAX_RETRIES) {
          // Marcar como fallido definitivamente
          await supabase
            .from("sync_events")
            .update({
              status: "failed",
              retry_count: retryCount,
              error_message: "Exceeded maximum retry attempts",
            })
            .eq("id", event.id)
        } else {
          // Programar próximo reintento
          const nextRetryAt = calculateNextRetryTime(retryCount)

          await supabase
            .from("sync_events")
            .update({
              status: "pending",
              retry_count: retryCount,
              next_retry_at: nextRetryAt.toISOString(),
            })
            .eq("id", event.id)
        }
      }
    } catch (error) {
      console.error(`Error processing sync event ${event.id}:`, error)

      // Actualizar el evento con el error
      await supabase
        .from("sync_events")
        .update({
          status: "pending",
          retry_count: event.retry_count + 1,
          error_message: (error as Error).message,
          next_retry_at: calculateNextRetryTime(event.retry_count + 1).toISOString(),
        })
        .eq("id", event.id)
    }
  }

  return processedCount
}

