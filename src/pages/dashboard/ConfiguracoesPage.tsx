import { useState, useRef, useEffect } from 'react'
import { Save, CheckCircle, Loader2, Zap, ZapOff, Clock, Calendar, MessageSquare, ChevronRight, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MSG_DEFAULT = 'Olá {nome}! Sua cobrança de {valor} vence no dia {dia}. Por favor, realize o pagamento em dia! 😊'

const HORAS = ['07:00', '08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00']

export default function ConfiguracoesPage() {
  const supabase = createClient()
  const [ativo,    setAtivo]    = useState(false)
  const [diaMes,   setDiaMes]   = useState(5)
  const [horario,  setHorario]  = useState('08:00')
  const [mensagem, setMensagem] = useState(MSG_DEFAULT)
  const [saved,    setSaved]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await (supabase as any)
          .from('configuracoes').select('*').eq('user_id', user.id).single()
        if (data) {
          setAtivo(data.ativo)
          setDiaMes(data.dia_mes)
          setHorario(data.horario.slice(0, 5))
          setMensagem(data.mensagem)
        }
      } catch { /* sem config ainda */ }
      setLoading(false)
    }
    load()
  }, [])

  async function salvar() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await (supabase as any).from('configuracoes').upsert(
          { user_id: user.id, ativo, dia_mes: diaMes, horario, mensagem },
          { onConflict: 'user_id' }
        )
      }
    } catch(e) { console.error(e) }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function inserirVariavel(v: string) {
    const el = textareaRef.current
    if (!el) return
    const s = el.selectionStart, e = el.selectionEnd
    setMensagem(mensagem.slice(0, s) + v + mensagem.slice(e))
    setTimeout(() => { el.focus(); el.setSelectionRange(s + v.length, s + v.length) }, 0)
  }

  // Preview com variáveis substituídas
  const preview = mensagem
    .replace(/\{nome\}/g, 'Maria Silva')
    .replace(/\{valor\}/g, 'R$ 350,00')
    .replace(/\{dia\}/g, String(diaMes))

  const horaCustom = !HORAS.includes(horario)

  // Dias do mês em grid 7x4
  const dias = Array.from({ length: 28 }, (_, i) => i + 1)

  return (
    <div className="max-w-3xl">

      {/* ── Header ── */}
      <header className="flex items-end justify-between gap-6 flex-wrap mb-6 pb-5 animate-fade-in" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-px" style={{ background: 'var(--color-brand)' }} />
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: 'var(--color-brand)' }}>
              Automação de Cobranças
            </p>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 2.6vw, 2.25rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-text)', lineHeight: 1.05 }}>
            Configurações
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Configure quando e como o sistema deve enviar cobranças automáticas pelo WhatsApp.
          </p>
        </div>
        <button
          onClick={salvar}
          disabled={saving || loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
          style={saved
            ? { background: 'rgba(74,222,128,0.1)', color: '#16a34a', border: '1px solid rgba(74,222,128,0.3)' }
            : saving || loading
            ? { background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }
            : { background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 20px color-mix(in srgb, var(--color-brand) 30%, transparent)' }
          }
        >
          {saved ? <><CheckCircle size={14} /> Salvo!</>
            : saving || loading ? <><Loader2 size={14} className="animate-spin" /> {loading ? 'Carregando...' : 'Salvando...'}</>
            : <><Save size={14} /> Salvar configurações</>}
        </button>
      </header>

      <div className="flex flex-col gap-4">

        {/* ══ BLOCO 1: Liga/Desliga ══ */}
        <div
          className="rounded-2xl overflow-hidden animate-fade-in cursor-pointer transition-all"
          style={{ border: `1px solid ${ativo ? 'color-mix(in srgb, var(--color-brand) 40%, transparent)' : 'var(--color-border)'}`, animationDelay: '40ms' }}
          onClick={() => setAtivo(v => !v)}
        >
          <div className="flex items-center justify-between p-5"
            style={{ background: ativo ? 'color-mix(in srgb, var(--color-brand) 6%, var(--color-surface-2))' : 'var(--color-surface-2)' }}>
            <div className="flex items-center gap-4">
              {/* Ícone grande */}
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all"
                style={{
                  background: ativo ? 'var(--color-brand)' : 'var(--color-surface-3)',
                  boxShadow: ativo ? '0 0 24px color-mix(in srgb, var(--color-brand) 40%, transparent)' : 'none',
                }}>
                {ativo
                  ? <Zap size={22} className="text-white" />
                  : <ZapOff size={22} style={{ color: 'var(--color-text-muted)' }} />}
              </div>
              <div>
                <p className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--color-text)' }}>
                  Cobrança automática
                </p>
                <p className="text-sm mt-0.5" style={{ color: ativo ? 'color-mix(in srgb, var(--color-brand) 80%, var(--color-text-muted))' : 'var(--color-text-muted)' }}>
                  {ativo
                    ? `✓ Ativa — mensagens enviadas todo dia ${diaMes} às ${horario}`
                    : 'Desativada — cobranças enviadas apenas manualmente'}
                </p>
              </div>
            </div>
            {/* Toggle */}
            <div className="shrink-0 w-14 h-7 rounded-full relative transition-all"
              style={{ background: ativo ? 'var(--color-brand)' : 'var(--color-surface-3)', border: `1px solid ${ativo ? 'var(--color-brand)' : 'var(--color-border)'}`, boxShadow: ativo ? '0 0 12px color-mix(in srgb, var(--color-brand) 30%, transparent)' : 'none' }}>
              <div className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all"
                style={{ left: ativo ? '28px' : '2px' }} />
            </div>
          </div>
        </div>

        {/* ══ BLOCO 2: Quando enviar ══ */}
        <div className="rounded-2xl overflow-hidden animate-fade-in" style={{ border: '1px solid var(--color-border)', animationDelay: '80ms' }}>

          {/* Header do bloco */}
          <button
            className="w-full flex items-center justify-between px-5 py-4 transition-all"
            style={{ background: 'var(--color-surface-3)', borderBottom: activeSection === 'quando' ? '1px solid var(--color-border)' : 'none' }}
            onClick={() => setActiveSection(activeSection === 'quando' ? null : 'quando')}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--color-brand) 12%, transparent)' }}>
                <Calendar size={15} style={{ color: 'var(--color-brand)' }} />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
                  Quando enviar
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Dia <strong style={{ color: 'var(--color-text)' }}>{diaMes}</strong> de cada mês · <strong style={{ color: 'var(--color-text)' }}>{horario}</strong>
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="transition-transform"
              style={{ color: 'var(--color-text-muted)', transform: activeSection === 'quando' ? 'rotate(90deg)' : 'rotate(0deg)' }} />
          </button>

          {activeSection === 'quando' && (
            <div style={{ background: 'var(--color-surface-2)' }}>

              {/* Dia do mês */}
              <div className="p-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={13} style={{ color: 'var(--color-brand)' }} />
                  <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                    Dia do mês para envio
                  </p>
                </div>

                {/* Grid de dias */}
                <div className="grid grid-cols-7 gap-1.5 mb-3">
                  {dias.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDiaMes(d)}
                      className="aspect-square rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center"
                      style={diaMes === d
                        ? { background: 'var(--color-brand)', color: 'white', boxShadow: '0 0 10px color-mix(in srgb, var(--color-brand) 40%, transparent)', fontSize: '13px' }
                        : { background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', fontSize: '13px' }
                      }
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--color-brand) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--color-brand) 20%, transparent)' }}>
                  <Info size={12} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    As cobranças serão enviadas todo dia <strong style={{ color: 'var(--color-brand)' }}>{diaMes}</strong> automaticamente para todos os clientes ativos.
                  </p>
                </div>
              </div>

              {/* Horário */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={13} style={{ color: 'var(--color-brand)' }} />
                  <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                    Horário de envio
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {HORAS.map((h) => (
                    <button key={h} onClick={() => setHorario(h)}
                      className="px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                      style={horario === h && !horaCustom
                        ? { background: 'var(--color-brand)', color: 'white', boxShadow: '0 0 10px color-mix(in srgb, var(--color-brand) 40%, transparent)' }
                        : { background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }
                      }>
                      {h}
                    </button>
                  ))}
                  {/* Horário personalizado */}
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={horario}
                      onChange={(e) => setHorario(e.target.value)}
                      className="px-3 py-2 rounded-xl text-sm font-bold outline-none transition-all"
                      style={{
                        background: horaCustom ? 'color-mix(in srgb, var(--color-brand) 10%, transparent)' : 'var(--color-surface-3)',
                        border: `1px solid ${horaCustom ? 'var(--color-brand)' : 'var(--color-border)'}`,
                        color: horaCustom ? 'var(--color-brand)' : 'var(--color-text-muted)',
                        colorScheme: 'dark',
                      }}
                    />
                    {horaCustom && <span className="text-xs" style={{ color: 'var(--color-brand)' }}>personalizado</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ BLOCO 3: Mensagem ══ */}
        <div className="rounded-2xl overflow-hidden animate-fade-in" style={{ border: '1px solid var(--color-border)', animationDelay: '120ms' }}>

          {/* Header */}
          <button
            className="w-full flex items-center justify-between px-5 py-4 transition-all"
            style={{ background: 'var(--color-surface-3)', borderBottom: activeSection === 'mensagem' ? '1px solid var(--color-border)' : 'none' }}
            onClick={() => setActiveSection(activeSection === 'mensagem' ? null : 'mensagem')}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--color-brand) 12%, transparent)' }}>
                <MessageSquare size={15} style={{ color: 'var(--color-brand)' }} />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
                  Mensagem de cobrança
                </p>
                <p className="text-xs truncate max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {mensagem.slice(0, 60)}{mensagem.length > 60 ? '…' : ''}
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="transition-transform"
              style={{ color: 'var(--color-text-muted)', transform: activeSection === 'mensagem' ? 'rotate(90deg)' : 'rotate(0deg)' }} />
          </button>

          {activeSection === 'mensagem' && (
            <div style={{ background: 'var(--color-surface-2)' }}>
              <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x"
                style={{ borderColor: 'var(--color-border)' }}>

                {/* Editor */}
                <div className="p-5">
                  {/* Variáveis */}
                  <p className="text-xs font-bold uppercase tracking-[0.14em] mb-3" style={{ color: 'var(--color-text-muted)' }}>
                    Clique para inserir variável
                  </p>
                  <div className="flex gap-2 mb-4">
                    {[
                      { var: '{nome}',  label: 'Nome do cliente', color: '#60a5fa' },
                      { var: '{valor}', label: 'Valor da cobrança', color: '#16a34a' },
                      { var: '{dia}',   label: 'Dia de vencimento', color: '#f59e0b' },
                    ].map(({ var: v, label, color }) => (
                      <button
                        key={v}
                        onClick={() => inserirVariavel(v)}
                        className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all active:scale-95 hover:-translate-y-0.5"
                        style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}
                        title={label}
                      >
                        <span className="text-xs font-bold" style={{ color }}>{v}</span>
                        <span className="text-[9px] leading-none" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Textarea */}
                  <textarea
                    ref={textareaRef}
                    rows={6}
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none leading-relaxed"
                    style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-brand) 10%, transparent)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
                  />
                  <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                    {mensagem.length} caracteres
                  </p>
                </div>

                {/* Preview estilo WhatsApp */}
                <div className="p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] mb-3" style={{ color: 'var(--color-text-muted)' }}>
                    Preview — como o cliente verá
                  </p>

                  {/* Simulação de chat */}
                  <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #1a1f2e' }}>
                    {/* Header do "WhatsApp" */}
                    <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#111827', borderBottom: '1px solid #1a1f2e' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'var(--color-brand)', color: 'white' }}>SC</div>
                      <div>
                        <p className="text-xs font-semibold text-white">Studio Charme</p>
                        <p className="text-[10px]" style={{ color: '#16a34a' }}>● online</p>
                      </div>
                    </div>

                    {/* Área de mensagem */}
                    <div className="p-4 min-h-32 flex flex-col justify-end gap-2">
                      {/* Bubble */}
                      <div className="max-w-[90%] self-start">
                        <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                          style={{ background: '#1e2736', color: '#e8e8f0' }}>
                          {preview || <span style={{ color: '#555' }}>Digite a mensagem...</span>}
                        </div>
                        <p className="text-[10px] mt-1 ml-1" style={{ color: '#555' }}>
                          {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Legenda das variáveis */}
                  <div className="mt-3 space-y-1.5">
                    {[
                      { var: '{nome}',  val: 'Maria Silva',   color: '#60a5fa' },
                      { var: '{valor}', val: 'R$ 350,00',     color: '#16a34a' },
                      { var: '{dia}',   val: String(diaMes),  color: '#f59e0b' },
                    ].map(({ var: v, val, color }) => (
                      <div key={v} className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-bold" style={{ color }}>{v}</span>
                        <span style={{ color: 'var(--color-border)' }}>→</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ Resumo do agendamento ══ */}
        <div className="rounded-2xl p-5 animate-fade-in"
          style={{ background: 'var(--color-surface-2)', border: `1px solid ${ativo ? 'color-mix(in srgb, var(--color-brand) 30%, transparent)' : 'var(--color-border)'}`, animationDelay: '160ms' }}>
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Resumo do agendamento
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: ativo ? 'rgba(74,222,128,0.1)' : 'var(--color-surface-3)', color: ativo ? '#4ade80' : 'var(--color-text-muted)', border: `1px solid ${ativo ? 'rgba(74,222,128,0.2)' : 'var(--color-border)'}` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ativo ? '#4ade80' : 'var(--color-border)', boxShadow: ativo ? '0 0 6px #4ade80' : 'none' }} />
              {ativo ? 'Automação ativa' : 'Automação inativa'}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
              <Calendar size={12} />
              Todo dia {diaMes}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
              <Clock size={12} />
              às {horario}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
