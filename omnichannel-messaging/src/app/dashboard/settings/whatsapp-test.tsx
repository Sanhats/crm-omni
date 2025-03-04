"use client"

import { useState, useEffect } from "react"
import { supabaseClient } from "@/lib/supabase/client"

export default function WhatsAppTestPage() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState("")

  useEffect(() => {
    // Obtener la URL del webhook
    const host = window.location.host
    const protocol = window.location.protocol
    setWebhookUrl(`${protocol}//${host}/api/webhooks/whatsapp`)
    
    fetchEvents()
    
    // Configurar actualización periódica
    const interval = setInterval(fetchEvents, 10000) // Actualizar cada 10 segundos
    
    return () => clearInterval(interval)
  }, [])
  
  const fetchEvents = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabaseClient
        .from("sync_events")
        .select("*")
        .eq("channel", "whatsapp")
        .order("created_at", { ascending: false })
        .limit(20)
        
      if (error) throw error
      
      setEvents(data || [])
    } catch (err) {
      console.error("Error fetching events:", err)
      setError("No se pudieron cargar los eventos")
    } finally {
      setLoading(false)
    }
  }
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }
  
  const formatJson = (json: any) => {
    try {
      return JSON.stringify(json, null, 2)
    } catch (e) {
      return "Error al formatear JSON"
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prueba de Webhook de WhatsApp</h1>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Configuración del Webhook</h2>
        
        <div className="space-y-4">
          <div>
            <p className="font-medium">URL del Webhook:</p>
            <div className="flex mt-1">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 px-3 py-2 border rounded-l-md bg-gray-50"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl)
                  alert("URL copiada al portapapeles")
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700"
              >
                Copiar
              </button>
            </div>
          </div>
          
          <div>
            <p className="font-medium">Pasos para verificar la configuración:</p>
            <ol className="list-decimal list-inside mt-2 space-y-2 text-sm">
              <li>Asegúrate de que tu servidor sea accesible desde Internet (usa ngrok si estás en desarrollo local)</li>
              <li>Configura el webhook en Meta for Developers con la URL mostrada arriba</li>
              <li>Usa el token secreto configurado en tus variables de entorno (WHATSAPP_WEBHOOK_SECRET)</li>
              <li>Verifica que la verificación del webhook sea exitosa</li>
              <li>Envía un mensaje de prueba al número de WhatsApp</li>
              <li>Revisa los eventos registrados a continuación</li>
            </ol>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Eventos Recientes</h2>
          <button
            onClick={fetchEvents}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Actualizar
          </button>
        </div>
        
        {loading && <div className="text-center py-4">Cargando eventos...</div>}
        
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded">
            {error}
          </div>
        )}
        
        {!loading && !error && events.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No hay eventos registrados. Envía un mensaje de prueba para ver los eventos.
          </div>
        )}
        
        {!loading && !error && events.length > 0 && (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="border rounded-md p-4">
                <div className="flex justify-between">
                  <span className="font-medium">{event.event_type}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    event.status === 'completed' ? 'bg-green-100 text-green-800' :
                    event.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {event.status}
                  </span>
                </div>
                
                <div className="text-sm text-gray-500 mt-1">
                  {formatDate(event.created_at)}
                </div>
                
                {event.error_message && (
                  <div className="mt-2 text-sm text-red-600">
                    Error: {event.error_message}
                  </div>
                )}
                
                <div className="mt-2">
                  <details>
                    <summary className="cursor-pointer text-sm text-indigo-600">Ver payload</summary>
                    <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-60">
                      {formatJson(event.payload)}
                    </pre>
                  </details>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}