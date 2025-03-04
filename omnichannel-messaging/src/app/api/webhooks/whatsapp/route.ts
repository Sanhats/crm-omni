import { NextRequest, NextResponse } from "next/server";

// Método GET para verificación del webhook
export async function GET(request: NextRequest) {
  console.log("GET request received");
  
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  
  console.log("Mode:", mode);
  console.log("Token:", token);
  console.log("Challenge:", challenge);

  // Verificar que sea una solicitud de suscripción y que el token coincida
  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
    console.log('Webhook verificado correctamente!');
    return new NextResponse(challenge);
  } else {
    console.log('Verificación fallida. Token incorrecto o modo inválido.');
    return new NextResponse('Verification failed', { status: 403 });
  }
}

// Método POST para recibir mensajes (simplificado para pruebas)
export async function POST(request: NextRequest) {
  console.log("POST request received");
  return NextResponse.json({ success: true });
}