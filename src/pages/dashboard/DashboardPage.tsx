import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { cacheGet, cacheSet } from '@/lib/cache'
import { TrendingUp, CreditCard, Clock, AlertCircle, ArrowRight } from 'lucide-react'

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

type Gestao  = { id: number; nome: string; valor: number; data: string; feito: string }
type Cliente = { id: number; nome: string; valor: number; status: string; dia_cobranca: number }

const STATUS_COLOR: Record<string, string> = { pago: '#4ade80', cobrado: '#60a5fa', pendente: '#f59e0b' }
const STATUS_LABEL: Record<string, string> = { pago: 'Pago', cobrado: 'Cobrado', pendente: 'Pendente' }

type CacheData = { gestoes: Gestao[]; clientes: Cliente[]; allGestoes: { valor: number }[]; allClientes: { valor: number; status: string }[] }

export default function DashboardPage() {
  const supabase = createClient()

  const cached = cacheGet<CacheData>('dashboard')
  const [gestoes,     setGestoes]     = useState<Gestao[]>(cached?.gestoes ?? [])
  const [clientes,    setClientes]    = useState<Cliente[]>(cached?.clientes ?? [])
  const [allGestoes,  setAllGestoes]  = useState<{ valor: number }[]>(cached?.allGestoes ?? [])
  const [allClientes, setAllClientes] = useState<{ valor: number; status: string }[]>(cached?.allClientes ?? [])
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setLoading(false); return }
        const uid = session.user.id
        const sb  = supabase as any

        // 4 queries em paralelo de uma vez
        const [g, c, ag, ac] = await Promise.all([
          sb.from('gestoes').select('id,nome,valor,data,feito').eq('user_id', uid).order('data', { ascending: false }).limit(5),
          sb.from('clientes').select('id,nome,valor,status,dia_cobranca').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
          sb.from('gestoes').select('valor').eq('user_id', uid),
          sb.from('clientes').select('valor,status').eq('user_id', uid),
        ])

        const data: CacheData = {
          gestoes:    g.data  ?? [],
          clientes:   c.data  ?? [],
          allGestoes: ag.data ?? [],
          allClientes: ac.data ?? [],
        }
        cacheSet('dashboard', data)
        setGestoes(data.gestoes)
        setClientes(data.clientes)
        setAllGestoes(data.allGestoes)
        setAllClientes(data.allClientes)
      } catch (err) { console.error('[Dashboard]', err) }
      setLoading(false)
    }
    load()
  }, [])

  const totalGestao   = allGestoes.reduce((a, r) => a + r.valor, 0)
  const totalPago     = allClientes.filter((c) => c.status === 'pago').reduce((a, c) => a + c.valor, 0)
  const totalPendente = allClientes.filter((c) => c.status === 'pendente').reduce((a, c) => a + c.valor, 0)
  const totalCobrado  = allClientes.filter((c) => c.status === 'cobrado').reduce((a, c) => a + c.valor, 0)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  const metrics = [
    { label: 'Total Gestões',   value: fmt(totalGestao),   icon: TrendingUp,  color: 'var(--color-brand)', href: '/dashboard/gestoes' },
    { label: 'Cobranças Pagas', value: fmt(totalPago),     icon: CreditCard,  color: '#4ade80',            href: '/dashboard/cobrancas' },
    { label: 'Pendente',        value: fmt(totalPendente), icon: Clock,       color: '#f59e0b',            href: '/dashboard/cobrancas' },
    { label: 'Cobrado',         value: fmt(totalCobrado),  icon: AlertCircle, color: '#60a5fa',            href: '/dashboard/cobrancas' },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div className="animate-fade-in">
        <p className="text-xs font-bold tracking-[0.18em] uppercase mb-1" style={{ color: 'var(--color-brand)' }}>{greeting}</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--color-text)' }}>
          Visão geral
        </h1>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 rounded-2xl" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                <span className="skeleton h-4 w-4 rounded block mb-4" />
                <span className="skeleton h-7 w-28 block mb-1.5" />
                <span className="skeleton h-3 w-20 block" />
              </div>
            ))
          : metrics.map((m, i) => {
              const Icon = m.icon
              return (
                <Link key={m.label} to={m.href}
                  className="p-5 rounded-2xl flex flex-col gap-3 transition-all hover:scale-[1.015] hover:-translate-y-0.5 animate-fade-in group"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', animationDelay: `${i * 50}ms` }}>
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `color-mix(in srgb, ${m.color} 12%, transparent)` }}>
                      <Icon size={16} style={{ color: m.color }} />
                    </div>
                    <ArrowRight size={13} className="opacity-0 group-hover:opacity-40 transition-all"
                      style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                  <div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: m.color, lineHeight: 1.1 }}>
                      {m.value}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{m.label}</p>
                  </div>
                </Link>
              )
            })}
      </div>

      {/* Tabelas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Gestões */}
        <div className="rounded-2xl overflow-hidden animate-fade-in" style={{ border: '1px solid var(--color-border)', animationDelay: '160ms' }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
            <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>Últimas Gestões</p>
            <Link to="/dashboard/gestoes" className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--color-brand)' }}>
              Ver todas <ArrowRight size={11} />
            </Link>
          </div>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                  <span className="skeleton h-3.5 w-28" /><span className="skeleton h-3.5 w-16" />
                </div>
              ))
            : gestoes.length === 0
            ? <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-2)' }}>Nenhuma gestão ainda.</div>
            : gestoes.map((g, i) => (
                <div key={g.id} className="flex items-center justify-between px-5 py-3.5 animate-fade-in"
                  style={{ background: 'var(--color-surface-2)', borderBottom: i < gestoes.length - 1 ? '1px solid var(--color-border)' : 'none', animationDelay: `${i * 30}ms` }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{g.nome || '—'}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{g.feito || '—'}</p>
                  </div>
                  <span className="ml-4 text-sm font-bold shrink-0" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-brand)' }}>
                    {fmt(g.valor)}
                  </span>
                </div>
              ))}
        </div>

        {/* Cobranças */}
        <div className="rounded-2xl overflow-hidden animate-fade-in" style={{ border: '1px solid var(--color-border)', animationDelay: '200ms' }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
            <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>Cobranças Recentes</p>
            <Link to="/dashboard/cobrancas" className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--color-brand)' }}>
              Ver todas <ArrowRight size={11} />
            </Link>
          </div>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                  <span className="skeleton h-3.5 w-28" /><span className="skeleton h-5 w-16 rounded-full" />
                </div>
              ))
            : clientes.length === 0
            ? <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-2)' }}>Nenhum cliente ainda.</div>
            : clientes.map((c, i) => {
                const color = STATUS_COLOR[c.status] ?? '#f59e0b'
                return (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3.5 animate-fade-in"
                    style={{ background: 'var(--color-surface-2)', borderBottom: i < clientes.length - 1 ? '1px solid var(--color-border)' : 'none', animationDelay: `${i * 30}ms` }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{c.nome}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Vence dia {c.dia_cobranca}</p>
                    </div>
                    <div className="ml-4 flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>{fmt(c.valor)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </div>
                  </div>
                )
              })}
        </div>
      </div>
    </div>
  )
}
