import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Solo aplicar a rutas de webhook
  if (request.nextUrl.pathname.startsWith('/api/webhooks')) {
    console.log(`[Middleware] ${request.method} request to ${request.nextUrl.pathname}`)
    
    // Registrar headers para depuración
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })
    console.log('[Middleware] Headers:', JSON.stringify(headers, null, 2))
    
    // Para solicitudes POST, intentar registrar el cuerpo
    if (request.method === 'POST') {
      console.log('[Middleware] Body cannot be logged in middleware (streaming), check route handler logs')
    }
  }
  
  return NextResponse.next()
}

// Configurar para que solo se ejecute en rutas específicas
export const config = {
  matcher: '/api/webhooks/:path*',
}