"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, User, Wrench, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import NotificationBell from "@/components/ui/NotificationBell";

const navItems = [
  { href: "/crew/hoy", label: "Hoy", icon: CalendarDays },
  { href: "/crew/trabajos", label: "Trabajos", icon: ClipboardList },
  { href: "/crew/equipo", label: "Equipo", icon: Wrench },
  { href: "/crew/perfil", label: "Perfil", icon: User },
];

export default function CrewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top header */}
      <header className="bg-green-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-700 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <span className="font-bold text-sm">The Green Side - Equipo</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell variant="light" />
          <button onClick={handleLogout} className="p-2 text-green-300 hover:text-white">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20">
        <div className="max-w-lg mx-auto px-4 py-4">{children}</div>
      </main>

      {/* Bottom navigation - mobile first */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-3 px-4 text-xs font-medium transition-colors ${
                  active ? "text-green-800" : "text-gray-400"
                }`}
              >
                <Icon size={22} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
