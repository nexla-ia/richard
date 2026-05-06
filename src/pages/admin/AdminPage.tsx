import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import AdminPanel from './AdminPanel'
import type { Profile } from '@/types'
import { Users, Shield, BarChart3 } from 'lucide-react'

export default function AdminPage() {
  const supabase = createClient()
  const { user } = useAuth()
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [totalItems,  setTotalItems]  = useState(0)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [profilesRes, itemsRes] = await Promise.all([
          (supabase as any).from('profiles').select('*').order('created_at', { ascending: false }),
          (supabase as any).from('items').select('*', { count: 'exact', head: true }),
        ])
        if (profilesRes.data) setAllProfiles(profilesRes.data as Profile[])
        setTotalItems(itemsRes.count ?? 0)
      } catch (err) { console.error('[Admin]', err) }
      setLoading(false)
    }
    load()
  }, [])

  const admins   = allProfiles.filter((p) => p.role === 'admin').length
  const metrics  = [
    { label: 'Usuários',    value: allProfiles.length, icon: Users,    color: 'var(--color-brand)' },
    { label: 'Itens',       value: totalItems,         icon: BarChart3, color: '#60a5fa' },
    { label: 'Admins',      value: admins,             icon: Shield,   color: '#f59e0b' },
  ]

  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div className="flex items-end justify-between animate-fade-in">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] uppercase mb-1" style={{ color: 'var(--color-brand)' }}>
            Painel
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
            Admin
          </h1>
        </div>
        <span className="px-3 py-1.5 rounded-xl text-xs font-bold tracking-wider"
          style={{ background: 'color-mix(in srgb, var(--color-brand) 12%, transparent)', color: 'var(--color-brand)', border: '1px solid color-mix(in srgb, var(--color-brand) 30%, transparent)' }}>
          ADMIN
        </span>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '40ms' }}>
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.label} className="p-5 rounded-2xl" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `color-mix(in srgb, ${m.color} 12%, transparent)` }}>
                  <Icon size={16} style={{ color: m.color }} />
                </div>
              </div>
              {loading
                ? <span className="skeleton h-8 w-12 block mb-1" />
                : <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, lineHeight: 1, color: m.color }}>{m.value}</p>}
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{m.label}</p>
            </div>
          )
        })}
      </div>

      {/* Tabela de usuários */}
      {!loading && user && (
        <div className="animate-fade-in" style={{ animationDelay: '80ms' }}>
          <AdminPanel profiles={allProfiles} currentUserId={user.id} />
        </div>
      )}

      {loading && (
        <div className="rounded-2xl overflow-hidden animate-pulse" style={{ border: '1px solid var(--color-border)' }}>
          <div className="px-5 py-4" style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
            <span className="skeleton h-4 w-36 block" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
              <span className="skeleton w-9 h-9 rounded-xl shrink-0" />
              <div className="flex-1"><span className="skeleton h-3.5 w-32 block mb-1.5" /><span className="skeleton h-3 w-48 block" /></div>
              <span className="skeleton h-7 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
