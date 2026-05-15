import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { cacheGet, cacheSet } from '@/lib/cache'
import { TrendingUp, CreditCard, Clock, CheckCircle2, ArrowUpRight, Plus } from 'lucide-react'

/* ─── Paleta light isolada (só esta página) ─── */
const LIGHT = {
  bg:        '#fafaf7',       // off-white quente
  paper:     '#ffffff',       // cartão branco puro
  paperAlt:  '#f5f4ef',       // alt sutil
  border:    '#e8e6df',       // borda papel
  borderSoft:'#ececea',
  text:      '#1a1a1a',
  textMute:  '#6b6b6b',
  textFaint: '#9d9b94',
  brand:     '#6366f1',
  ink:       '#0a0a0a',
}

const STATUS = {
  pago:     { color: '#16a34a', label: 'Pago' },
  cobrado:  { color: '#2563eb', label: 'Enviado' },
  pendente: { color: '#d97706', label: 'Aguardando' },
} as Record<string, { color: string; label: string }>

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

type Gestao  = { id: number; nome: string; valor: number; data: string; feito: string }
type Cliente = { id: number; nome: string; valor: number; status: string; dia_cobranca: number }

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
        setGestoes(data.gestoes); setClientes(data.clientes)
        setAllGestoes(data.allGestoes); setAllClientes(data.allClientes)
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
    { label: 'Total em gestões',     hint: 'Soma de todos os trabalhos registrados',  value: totalGestao,   icon: TrendingUp,   color: LIGHT.brand, href: '/dashboard/voucher'  },
    { label: 'Já recebido',          hint: 'Cobranças que foram pagas',                value: totalPago,     icon: CheckCircle2, color: '#16a34a',   href: '/dashboard/cobrancas' },
    { label: 'A receber',            hint: 'Cobranças ainda não pagas',                value: totalPendente, icon: Clock,        color: '#d97706',   href: '/dashboard/cobrancas' },
    { label: 'Cobranças enviadas',   hint: 'Mensagens disparadas aguardando pagamento', value: totalCobrado, icon: CreditCard,   color: '#2563eb',   href: '/dashboard/cobrancas' },
  ]

  return (
    <div
      className="-mx-6 lg:-mx-10 -mt-10 -mb-10 px-6 lg:px-12 pt-6 pb-16 min-h-screen"
      style={{ background: LIGHT.bg, color: LIGHT.text, fontFamily: 'var(--font-sans)' }}
    >
      {/* Textura papel sutil */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.015]" style={{
        backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
        backgroundSize: '4px 4px',
      }} />

      <div className="relative max-w-6xl mx-auto">

        {/* ══ Header compacto ══ */}
        <header className="animate-fade-in pb-5 mb-6" style={{ borderBottom: `1px solid ${LIGHT.border}` }}>
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-6 h-px" style={{ background: LIGHT.brand }} />
                <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: LIGHT.brand }}>
                  {greeting}
                </p>
              </div>
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.75rem, 2.6vw, 2.25rem)',
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                color: LIGHT.ink,
              }}>
                Visão geral do seu negócio
              </h1>
            </div>

            <p className="text-xs capitalize" style={{ color: LIGHT.textMute }}>
              {todayLabel()}
            </p>
          </div>
        </header>


        {/* ══ Métricas — números grandes estilo relatório ══ */}
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: LIGHT.textFaint }}>
              Resumo Financeiro
            </h2>
            <span className="text-xs" style={{ color: LIGHT.textMute }}>4 indicadores</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-6 rounded-xl" style={{ background: LIGHT.paper, border: `1px solid ${LIGHT.borderSoft}` }}>
                    <div className="skeleton-light h-3 w-16 mb-4 rounded" />
                    <div className="skeleton-light h-9 w-32 mb-2 rounded" />
                    <div className="skeleton-light h-3 w-24 rounded" />
                  </div>
                ))
              : metrics.map((m, i) => {
                  const Icon = m.icon
                  return (
                    <Link
                      key={m.label}
                      to={m.href}
                      className="group block p-6 rounded-xl transition-all hover:-translate-y-0.5 animate-fade-in relative overflow-hidden"
                      style={{
                        background: LIGHT.paper,
                        border: `1px solid ${LIGHT.borderSoft}`,
                        boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
                        animationDelay: `${i * 50}ms`,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 12px 32px -12px ${m.color}40, 0 1px 0 rgba(0,0,0,0.04)` }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 0 rgba(0,0,0,0.02)' }}
                    >
                      {/* Faixa lateral colorida */}
                      <span className="absolute left-0 top-6 bottom-6 w-0.75 rounded-r-full" style={{ background: m.color }} />

                      {/* Cabeçalho do indicador */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-bold tracking-[0.18em] uppercase pl-1" style={{ color: LIGHT.textFaint }}>
                          {m.label}
                        </p>
                        <Icon size={14} style={{ color: m.color, opacity: 0.7 }} />
                      </div>

                      {/* Número */}
                      <p className="pl-1" style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: m.value >= 10000 ? '1.6rem' : '1.85rem',
                        fontWeight: 700,
                        lineHeight: 1,
                        color: m.color,
                        letterSpacing: '-0.02em',
                      }}>
                        {fmt(m.value)}
                      </p>

                      <p className="text-xs mt-2 pl-1 leading-snug" style={{ color: LIGHT.textMute }}>
                        {m.hint}
                      </p>

                      {/* Setinha que aparece no hover */}
                      <ArrowUpRight
                        size={14}
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-60 transition-all"
                        style={{ color: m.color }}
                      />
                    </Link>
                  )
                })}
          </div>
        </section>

        {/* ══ Atividade recente — duas tabelas ══ */}
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: LIGHT.textFaint }}>
              Atividade Recente
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Gestões */}
            <article className="rounded-xl overflow-hidden animate-fade-in"
              style={{ background: LIGHT.paper, border: `1px solid ${LIGHT.borderSoft}`, animationDelay: '180ms' }}>
              <header className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${LIGHT.borderSoft}` }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600, color: LIGHT.ink, letterSpacing: '-0.01em' }}>
                    Últimas Gestões
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: LIGHT.textMute }}>Trabalhos que você registrou</p>
                </div>
                <Link to="/dashboard/voucher"
                  className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-60"
                  style={{ color: LIGHT.brand }}>
                  Ver tudo <ArrowUpRight size={11} />
                </Link>
              </header>

              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-4" style={{ borderBottom: i < 3 ? `1px solid ${LIGHT.borderSoft}` : 'none' }}>
                    <div className="skeleton-light h-3.5 w-28 rounded" />
                    <div className="skeleton-light h-3.5 w-16 rounded" />
                  </div>
                ))
              ) : gestoes.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm font-medium mb-1" style={{ color: LIGHT.text }}>Nenhuma gestão ainda</p>
                  <p className="text-xs mb-5" style={{ color: LIGHT.textMute }}>Cadastre seu primeiro trabalho aqui</p>
                  <Link to="/dashboard/voucher"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5"
                    style={{ background: LIGHT.brand, color: 'white', boxShadow: `0 4px 14px -4px ${LIGHT.brand}` }}>
                    <Plus size={13} /> Adicionar gestão
                  </Link>
                </div>
              ) : (
                gestoes.map((g, i) => (
                  <div key={g.id}
                    className="flex items-center justify-between px-5 py-4 animate-fade-in transition-colors"
                    style={{ borderBottom: i < gestoes.length - 1 ? `1px solid ${LIGHT.borderSoft}` : 'none', animationDelay: `${i * 30}ms` }}
                    onMouseEnter={(e) => e.currentTarget.style.background = LIGHT.paperAlt}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: LIGHT.text }}>
                        {g.nome || 'Sem nome'}
                      </p>
                      <p className="text-xs truncate mt-0.5" style={{ color: LIGHT.textMute }}>
                        {g.feito || 'Sem descrição'}
                      </p>
                    </div>
                    <span className="ml-4 shrink-0" style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: LIGHT.brand,
                      letterSpacing: '-0.01em',
                    }}>
                      {fmt(g.valor)}
                    </span>
                  </div>
                ))
              )}
            </article>

            {/* Clientes */}
            <article className="rounded-xl overflow-hidden animate-fade-in"
              style={{ background: LIGHT.paper, border: `1px solid ${LIGHT.borderSoft}`, animationDelay: '220ms' }}>
              <header className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${LIGHT.borderSoft}` }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600, color: LIGHT.ink, letterSpacing: '-0.01em' }}>
                    Clientes Recentes
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: LIGHT.textMute }}>Status de cada cobrança</p>
                </div>
                <Link to="/dashboard/cobrancas"
                  className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-60"
                  style={{ color: LIGHT.brand }}>
                  Ver tudo <ArrowUpRight size={11} />
                </Link>
              </header>

              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-4" style={{ borderBottom: i < 3 ? `1px solid ${LIGHT.borderSoft}` : 'none' }}>
                    <div className="skeleton-light h-3.5 w-28 rounded" />
                    <div className="skeleton-light h-5 w-16 rounded-full" />
                  </div>
                ))
              ) : clientes.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm font-medium mb-1" style={{ color: LIGHT.text }}>Nenhum cliente ainda</p>
                  <p className="text-xs mb-5" style={{ color: LIGHT.textMute }}>Cadastre seu primeiro cliente aqui</p>
                  <Link to="/dashboard/cobrancas"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5"
                    style={{ background: LIGHT.brand, color: 'white', boxShadow: `0 4px 14px -4px ${LIGHT.brand}` }}>
                    <Plus size={13} /> Adicionar cliente
                  </Link>
                </div>
              ) : (
                clientes.map((c, i) => {
                  const cfg = STATUS[c.status] ?? { color: '#d97706', label: c.status }
                  return (
                    <div key={c.id}
                      className="flex items-center justify-between px-5 py-4 animate-fade-in transition-colors"
                      style={{ borderBottom: i < clientes.length - 1 ? `1px solid ${LIGHT.borderSoft}` : 'none', animationDelay: `${i * 30}ms` }}
                      onMouseEnter={(e) => e.currentTarget.style.background = LIGHT.paperAlt}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: LIGHT.text }}>{c.nome}</p>
                        <p className="text-xs mt-0.5" style={{ color: LIGHT.textMute }}>Vence todo dia {c.dia_cobranca}</p>
                      </div>
                      <div className="ml-4 flex flex-col items-end gap-1 shrink-0">
                        <span style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          color: LIGHT.ink,
                          letterSpacing: '-0.01em',
                        }}>
                          {fmt(c.valor)}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide uppercase"
                          style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </article>
          </div>
        </section>

        {/* Rodapé sutil */}
        <footer className="mt-16 pt-6 text-center" style={{ borderTop: `1px solid ${LIGHT.borderSoft}` }}>
          <p className="text-[10px] tracking-[0.18em] uppercase" style={{ color: LIGHT.textFaint }}>
            Studio Charme · Painel de Controle
          </p>
        </footer>
      </div>

      {/* Skeleton claro custom (sobrescreve o dark) */}
      <style>{`
        .skeleton-light {
          background: linear-gradient(90deg, ${LIGHT.paperAlt} 25%, ${LIGHT.borderSoft} 50%, ${LIGHT.paperAlt} 75%);
          background-size: 700px 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          display: block;
        }
      `}</style>
    </div>
  )
}
