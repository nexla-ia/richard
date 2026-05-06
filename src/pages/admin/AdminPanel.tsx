import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, User, Loader2 } from 'lucide-react'
import type { Profile } from '@/types'

export default function AdminPanel({ profiles: init, currentUserId }: { profiles: Profile[]; currentUserId: string }) {
  const supabase = createClient()
  const [profiles, setProfiles]   = useState(init)
  const [updatingId, setUpdating] = useState<string | null>(null)

  async function toggleRole(p: Profile) {
    if (p.id === currentUserId) return
    setUpdating(p.id)
    const newRole = p.role === 'admin' ? 'user' : 'admin'
    const { error } = await (supabase as any).from('profiles').update({ role: newRole }).eq('id', p.id)
    if (!error) setProfiles((prev) => prev.map((x) => x.id === p.id ? { ...x, role: newRole } : x))
    setUpdating(null)
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
        <p className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)' }}>Usuários cadastrados</p>
        <span className="text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
          {profiles.length} total
        </span>
      </div>

      <div>
        {profiles.map((p, i) => (
          <div key={p.id} className="flex items-center gap-4 px-5 py-4 transition-all"
            style={{ borderBottom: i < profiles.length - 1 ? '1px solid var(--color-border)' : 'none' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--color-brand) 2%, var(--color-surface-2))'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
              style={{
                background: p.role === 'admin' ? 'color-mix(in srgb, var(--color-brand) 15%, transparent)' : 'var(--color-surface-3)',
                color: p.role === 'admin' ? 'var(--color-brand)' : 'var(--color-text-muted)',
                border: `1px solid ${p.role === 'admin' ? 'color-mix(in srgb, var(--color-brand) 30%, transparent)' : 'var(--color-border)'}`,
              }}>
              {(p.full_name || p.email || '?')[0].toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                {p.full_name || 'Sem nome'}
                {p.id === currentUserId && (
                  <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>(você)</span>
                )}
              </p>
              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {p.email} · {new Date(p.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>

            {/* Role badge + toggle */}
            <button
              onClick={() => toggleRole(p)}
              disabled={updatingId === p.id || p.id === currentUserId}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              style={{
                background: p.role === 'admin' ? 'color-mix(in srgb, var(--color-brand) 12%, transparent)' : 'var(--color-surface-3)',
                color:      p.role === 'admin' ? 'var(--color-brand)' : 'var(--color-text-muted)',
                border:     `1px solid ${p.role === 'admin' ? 'color-mix(in srgb, var(--color-brand) 30%, transparent)' : 'var(--color-border)'}`,
              }}>
              {updatingId === p.id
                ? <Loader2 size={12} className="animate-spin" />
                : p.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
              {p.role === 'admin' ? 'Admin' : 'Usuário'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
