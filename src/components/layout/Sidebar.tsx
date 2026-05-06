import { Link, useLocation, useNavigate } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard, ClipboardList, CreditCard,
  Settings, Shield, LogOut, Camera, Menu, X,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard',               label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/gestoes',       label: 'Gestões',       icon: ClipboardList },
  { href: '/dashboard/cobrancas',     label: 'Cobranças',     icon: CreditCard },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings },
  { href: '/admin',                   label: 'Admin',         icon: Shield, adminOnly: true },
]

export default function Sidebar() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const supabase  = createClient()
  const { role, userName, userEmail, avatarUrl } = useAuth()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const visible = navItems.filter((i) => !i.adminOnly || role === 'admin')
  const initials = (userName || userEmail || 'U')[0].toUpperCase()

  const Content = () => (
    <div className="flex flex-col h-full">

      {/* ── Logo ── */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-brand)', boxShadow: '0 0 16px color-mix(in srgb, var(--color-brand) 40%, transparent)' }}>
            <Camera size={15} className="text-white" />
          </div>
          <div>
            <p className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
              Studio
            </p>
            <p className="text-sm font-bold leading-none" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
              Charme
            </p>
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visible.map((item) => {
          const Icon   = item.icon
          const active = location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group"
              style={{
                background: active ? 'color-mix(in srgb, var(--color-brand) 10%, var(--color-surface-3))' : 'transparent',
                color:      active ? 'var(--color-text)' : 'var(--color-text-muted)',
              }}
            >
              {/* Indicador ativo */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                  style={{ background: 'var(--color-brand)', boxShadow: '0 0 8px var(--color-brand)' }} />
              )}
              <Icon
                size={16}
                style={{ color: active ? 'var(--color-brand)' : 'var(--color-text-muted)', transition: 'color 0.15s' }}
              />
              <span>{item.label}</span>
              {item.adminOnly && (
                <span className="ml-auto text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: 'color-mix(in srgb, var(--color-brand) 20%, transparent)', color: 'var(--color-brand)', border: '1px solid color-mix(in srgb, var(--color-brand) 40%, transparent)' }}>
                  ADM
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Usuário ── */}
      <div className="px-3 pb-4" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
          style={{ background: 'var(--color-surface-3)' }}>
          {/* Avatar */}
          <div className="w-7 h-7 rounded-lg shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--color-brand)', color: 'white', fontSize: '11px' }}>
            {avatarUrl
              ? <img src={avatarUrl.startsWith('data:') ? avatarUrl : `data:image/jpeg;base64,${avatarUrl}`} alt="" className="w-full h-full object-cover" />
              : initials}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>
              {userName || 'Usuário'}
            </p>
            <p className="truncate" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              {userEmail}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; e.currentTarget.style.color = '#f87171' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)' }}
        >
          <LogOut size={14} /> Sair da conta
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
        onClick={() => setOpen(!open)}>
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {open && <div className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />}

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed left-0 top-0 h-full z-40 w-56 transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--color-surface-2)', borderRight: '1px solid var(--color-border)' }}>
        <Content />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-56 h-screen sticky top-0 shrink-0"
        style={{ background: 'var(--color-surface-2)', borderRight: '1px solid var(--color-border)' }}>
        <Content />
      </aside>
    </>
  )
}
