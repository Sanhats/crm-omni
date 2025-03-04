/**
 * Servicio para interactuar con la API de WhatsApp
 */

// Constantes
const WHATSAPP_API_VERSION = "v18.0"
const WHATSAPP_PHONE_NUMBER_ID = process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN
const WHATSAPP_API_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}`

/**
 * Envía un mensaje de texto a través de WhatsApp
 * @param to Número de teléfono del destinatario (con código de país)
 * @param text Texto del mensaje
 * @returns Respuesta de la API
 */
export async function sendWhatsAppTextMessage(to: string, text: string) {
  try {
    console.log(`Sending WhatsApp message to ${to}: ${text}`)

    // Asegurarse de que el número tenga el formato correcto (solo dígitos)
    const formattedTo = to.replace(/\D/g, "")

    const response = await fetch(`${WHATSAPP_API_URL}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedTo,
        type: "text",
        text: {
          body: text,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("WhatsApp API error:", errorData)
      throw new Error(`WhatsApp API error: ${errorData.error?.message || "Unknown error"}`)
    }

    const data = await response.json()
    console.log("WhatsApp API response:", data)
    return data
  } catch (error) {
    console.error("Error sending WhatsApp message:", error)
    throw error
  }
}

/**
 * Envía una imagen a través de WhatsApp
 * @param to Número de teléfono del destinatario (con código de país)
 * @param imageUrl URL de la imagen
 * @param caption Texto opcional para la imagen
 * @returns Respuesta de la API
 */
export async function sendWhatsAppImage(to: string, imageUrl: string, caption?: string) {
  try {
    console.log(`Sending WhatsApp image to ${to}: ${imageUrl}`)

    // Asegurarse de que el número tenga el formato correcto (solo dígitos)
    const formattedTo = to.replace(/\D/g, "")

    const response = await fetch(`${WHATSAPP_API_URL}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedTo,
        type: "image",
        image: {
          link: imageUrl,
          caption: caption || "",
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("WhatsApp API error:", errorData)
      throw new Error(`WhatsApp API error: ${errorData.error?.message || "Unknown error"}`)
    }

    const data = await response.json()
    console.log("WhatsApp API response:", data)
    return data
  } catch (error) {
    console.error("Error sending WhatsApp image:", error)
    throw error
  }
}

