"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChatBubbleLeftRightIcon, Cog6ToothIcon, ArrowLeftOnRectangleIcon } from "@heroicons/react/24/outline"
import { supabaseClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabaseClient.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="w-64 bg-white shadow-md hidden md:block">
      <div className="h-full flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-semibold text-gray-800">Mensajería Omnicanal</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/dashboard/conversations"
            className={`flex items-center px-4 py-2 text-sm rounded-md ${
              pathname.includes("/conversations") ? "bg-indigo-100 text-indigo-700" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5 mr-3" />
            Conversaciones
          </Link>

          <Link
            href="/dashboard/settings"
            className={`flex items-center px-4 py-2 text-sm rounded-md ${
              pathname.includes("/settings") ? "bg-indigo-100 text-indigo-700" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Cog6ToothIcon className="w-5 h-5 mr-3" />
            Configuración
          </Link>
        </nav>

        <div className="p-4 border-t">
          <button
            onClick={handleSignOut}
            className="flex items-center px-4 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100 w-full"
          >
            <ArrowLeftOnRectangleIcon className="w-5 h-5 mr-3" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

