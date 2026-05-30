'use client'

import {
  BarChart3,
  BookOpen,
  Brain,
  Calendar,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/queue',      label: 'Review Queue', icon: Brain },
  { href: '/topics',     label: 'Topics',       icon: BookOpen },
  { href: '/flashcards', label: 'Flashcards',   icon: Zap },
  { href: '/exams',      label: 'Exams',        icon: Calendar },
  { href: '/files',      label: 'Files',        icon: FileText },
  { href: '/analytics',  label: 'Analytics',    icon: BarChart3 },
  { href: '/settings',   label: 'Settings',     icon: Settings },
]

interface SidebarProps {
  userEmail: string
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 flex flex-col bg-white/80 backdrop-blur-md border-r border-primary-100 shadow-glass z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-primary-100">
        <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4 text-white" aria-hidden="true" />
        </div>
        <span className="text-lg font-bold text-primary-900">LearnOS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5" aria-label="Main navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn('nav-item', active && 'nav-item-active')}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-primary-100 space-y-1">
        <div className="px-3 py-2 text-xs text-muted-foreground truncate" title={userEmail}>
          {userEmail}
        </div>
        <button
          onClick={signOut}
          className="nav-item w-full text-left text-red-600 hover:bg-red-50 hover:text-red-700"
          type="button"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
