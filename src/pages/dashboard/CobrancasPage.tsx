import { useState, useEffect, useRef } from 'react'
import {
  Send, Users, CheckCircle, Clock, MessageSquare,
  Loader2, DollarSign, AlertCircle, ChevronDown, ChevronUp,
  Plus, X, Trash2, Upload, FileSpreadsheet, CheckCheck, Download,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { cacheGet, cacheSet, cacheInvalidate } from '@/lib/cache'

/* ─── Template CSV pra Clientes ─── */
const CSV_TEMPLATE_CLIENTES = `Nome,Telefone,Valor,Dia de cobrança\nMaria Silva,11999990000,350.00,5\nJoão Pereira,21988887777,500.00,10\nAna Costa,31977776666,250.00,15`

function downloadClientesTemplate() {
  // BOM UTF-8 pra Excel abrir com acentos certos
  const blob = new Blob(['﻿' + CSV_TEMPLATE_CLIENTES], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'modelo_clientes.csv'; a.click()
  URL.revokeObjectURL(url)
}

type Status = 'pendente' | 'cobrado' | 'pago'

type Cliente = {
  id: number
  nome: string
  valor: number
  telefone: string
  dia_cobranca: number
  status: Status
  cobrado_em?: string
}

const WEBHOOK_URL = 'https://n8n.nexladesenvolvimento.com.br/webhook/0b4f66aa-9c8f-49e8-bb6b-91371f390ead'

const STATUS_CFG = {
  pendente: { label: 'Aguardando', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)', icon: Clock },
  cobrado:  { label: 'Enviado',    color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)', icon: Send },
  pago:     { label: 'Pago',     color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)', icon: CheckCircle },
} satisfies Record<Status, { label: string; color: string; bg: string; border: string; icon: React.ElementType }>

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}
function defaultMsg(c: Cliente) {
  return `Olá ${c.nome}! Passando para lembrar que sua cobrança de ${fmt(c.valor)} vence no dia ${c.dia_cobranca}. Qualquer dúvida, estou à disposição!`
}
async function dispararWebhook(payload: object): Promise<boolean> {
  try {
    const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    return res.ok
  } catch { return false }
}

function StatusBadge({ status, onClick, title }: { status: Status; onClick?: () => void; title?: string }) {
  const cfg = STATUS_CFG[status]
  const Icon = cfg.icon
  return (
    <button onClick={onClick} title={title}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-[0.95]"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, cursor: onClick ? 'pointer' : 'default' }}>
      <Icon size={10} />{cfg.label}
    </button>
  )
}

function Avatar({ nome }: { nome: string }) {
  const initials = nome.trim().split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
      style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
      {initials}
    </div>
  )
}

type PageTab = 'cobrancas' | 'pagamentos'
type ChargeMode = 'individual' | 'massa'

const COUNTRIES = [
  { flag: '🇧🇷', name: 'Brasil',      code: '+55',  mask: '(##) #####-####', max: 11 },
  { flag: '🇵🇹', name: 'Portugal',    code: '+351', mask: '### ### ###',      max: 9  },
  { flag: '🇺🇸', name: 'EUA',         code: '+1',   mask: '(###) ###-####',   max: 10 },
  { flag: '🇦🇷', name: 'Argentina',   code: '+54',  mask: '## ####-####',     max: 10 },
  { flag: '🇨🇱', name: 'Chile',       code: '+56',  mask: '# ####-####',      max: 9  },
  { flag: '🇨🇴', name: 'Colômbia',    code: '+57',  mask: '### ###-####',     max: 10 },
  { flag: '🇲🇽', name: 'México',      code: '+52',  mask: '## ####-####',     max: 10 },
  { flag: '🇵🇾', name: 'Paraguai',    code: '+595', mask: '### ###-###',      max: 9  },
  { flag: '🇺🇾', name: 'Uruguai',     code: '+598', mask: '### ##-##-##',     max: 9  },
  { flag: '🇧🇴', name: 'Bolívia',     code: '+591', mask: '########',         max: 8  },
  { flag: '🇵🇪', name: 'Peru',        code: '+51',  mask: '### ###-###',      max: 9  },
  { flag: '🇪🇨', name: 'Equador',     code: '+593', mask: '## ###-####',      max: 9  },
  { flag: '🇬🇧', name: 'Reino Unido', code: '+44',  mask: '#### ### ####',    max: 10 },
  { flag: '🇩🇪', name: 'Alemanha',    code: '+49',  mask: '#### #######',     max: 11 },
  { flag: '🇫🇷', name: 'França',      code: '+33',  mask: '# ## ## ## ##',    max: 9  },
  { flag: '🇪🇸', name: 'Espanha',     code: '+34',  mask: '### ### ###',      max: 9  },
  { flag: '🇮🇹', name: 'Itália',      code: '+39',  mask: '### #### ###',     max: 10 },
  { flag: '🇯🇵', name: 'Japão',       code: '+81',  mask: '##-####-####',     max: 10 },
  { flag: '🇨🇳', name: 'China',       code: '+86',  mask: '### ####-####',    max: 11 },
  { flag: '🇮🇳', name: 'Índia',       code: '+91',  mask: '##### #####',      max: 10 },
]

export default function CobrancasPage() {
  const supabase = createClient()

  const cachedClientes = cacheGet<Cliente[]>('clientes')
  const [clientes, setClientes] = useState<Cliente[]>(cachedClientes ?? [])
  const [loading, setLoading] = useState(!cachedClientes)
  const [pageTab, setPageTab] = useState<PageTab>('cobrancas')
  const [chargeMode, setChargeMode] = useState<ChargeMode>('individual')
  const [filterStatus, setFilterStatus] = useState<Status | 'todos'>('todos')

  const [openId, setOpenId] = useState<number | null>(null)
  const [mensagens, setMensagens] = useState<Record<number, string>>({})
  const [sendingId, setSendingId] = useState<number | null>(null)
  const [errorId, setErrorId] = useState<number | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [mensagemMassa, setMensagemMassa] = useState('')
  const [sendingMassa, setSendingMassa] = useState(false)
  const [sentMassa, setSentMassa] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nome: '', telefone: '', valor: '', dia_cobranca: '5' })
  const [country, setCountry] = useState(COUNTRIES[0])
  const [showCountries, setShowCountries] = useState(false)

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; clienteId: number } | null>(null)

  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState<{ nome: string; telefone: string; valor: string; dia_cobranca: string }[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importDragOver, setImportDragOver] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setLoading(false); return }
        const { data } = await (supabase as any).from('clientes').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
        const list = (data as Cliente[]) ?? []
        cacheSet('clientes', list)
        setClientes(list)
      } catch (err) { console.error('[Cobrancas]', err) }
      setLoading(false)
    }
    load()
  }, [])

  function invalidate() { cacheInvalidate('clientes'); cacheInvalidate('dashboard') }

  function openCtxMenu(e: React.MouseEvent, id: number) {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, clienteId: id })
  }

  async function addCliente() {
    const v = parseFloat(form.valor.replace(',', '.'))
    if (!form.nome.trim() || isNaN(v)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await (supabase as any).from('clientes').insert({
      user_id: user.id,
      nome: form.nome.trim(),
      telefone: form.telefone.trim() ? `${country.code} ${form.telefone.trim()}` : '',
      valor: v,
      dia_cobranca: Math.min(28, Math.max(1, Number(form.dia_cobranca) || 1)),
      status: 'pendente',
    }).select().single()
    invalidate()
    if (!error && data) setClientes((p) => [data as Cliente, ...p])
    setForm({ nome: '', telefone: '', valor: '', dia_cobranca: '5' })
    setShowModal(false)
  }

  const totals = {
    pendente: clientes.filter((c) => c.status === 'pendente').reduce((a, c) => a + c.valor, 0),
    cobrado:  clientes.filter((c) => c.status === 'cobrado').reduce((a, c) => a + c.valor, 0),
    pago:     clientes.filter((c) => c.status === 'pago').reduce((a, c) => a + c.valor, 0),
  }

  const listaCobrar = clientes.filter((c) => filterStatus === 'todos' || c.status === filterStatus)

  function getMensagem(c: Cliente) { return mensagens[c.id] ?? defaultMsg(c) }

  async function setStatus(id: number, status: Status, cobrado_em?: string) {
    setClientes((p) => p.map((c) => c.id === id ? { ...c, status, ...(cobrado_em ? { cobrado_em } : {}) } : c))
    await (supabase as any).from('clientes').update({ status, ...(cobrado_em ? { cobrado_em } : {}) }).eq('id', id)
    invalidate()
  }

  async function deleteCliente(id: number) {
    setClientes((p) => p.filter((c) => c.id !== id))
    await (supabase as any).from('clientes').delete().eq('id', id)
    invalidate()
  }

  async function cobrarUm(c: Cliente) {
    setSendingId(c.id); setErrorId(null)
    const hoje = new Date().toLocaleDateString('pt-BR')
    const ok = await dispararWebhook({ nome: c.nome, telefone: c.telefone, valor: c.valor, dia_cobranca: c.dia_cobranca, mensagem: getMensagem(c) })
    setSendingId(null)
    if (ok) { setStatus(c.id, 'cobrado', hoje); setOpenId(null) }
    else setErrorId(c.id)
  }

  async function cobrarMassa() {
    const alvos = clientes.filter((c) => selectedIds.has(c.id))
    if (!alvos.length) return
    setSendingMassa(true)
    const hoje = new Date().toLocaleDateString('pt-BR')
    await Promise.all(alvos.map((c) =>
      dispararWebhook({ nome: c.nome, telefone: c.telefone, valor: c.valor, dia_cobranca: c.dia_cobranca, mensagem: mensagemMassa || defaultMsg(c) })
    ))
    const ids = [...selectedIds]
    setClientes((p) => p.map((c) => selectedIds.has(c.id) ? { ...c, status: 'cobrado', cobrado_em: hoje } : c))
    await (supabase as any).from('clientes').update({ status: 'cobrado', cobrado_em: hoje }).in('id', ids)
    invalidate()
    setSendingMassa(false); setSentMassa(true); setSelectedIds(new Set())
    setTimeout(() => setSentMassa(false), 3000)
  }

  function toggleSelect(id: number) {
    setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function cyclePago(c: Cliente) {
    if (c.status === 'pendente') return
    setStatus(c.id, c.status === 'cobrado' ? 'pago' : 'cobrado')
  }

  function processFile(file: File) {
    setImportError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const buf = ev.target?.result
        const wb  = XLSX.read(buf, { type: 'array', cellDates: false })
        const ws  = wb.Sheets[wb.SheetNames[0]]
        if (!ws) throw new Error('Planilha vazia')
        const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
        const rowsArr = matrix.filter((r) => r.some((c) => String(c ?? '').trim()))
        if (rowsArr.length === 0) throw new Error('Sem dados na planilha')

        // detecta cabeçalho — coluna C (valor) deve ser número
        const skipHeader = isNaN(parseFloat(String(rowsArr[0][2] ?? '').replace(',', '.')))
        const dataRows   = skipHeader ? rowsArr.slice(1) : rowsArr

        const parsed = dataRows.map((cols) => ({
          nome:         String(cols[0] ?? '').trim(),
          telefone:     String(cols[1] ?? '').trim().replace(/\D/g, ''),
          valor:        String(cols[2] ?? '').trim(),
          dia_cobranca: String(cols[3] ?? '5').trim(),
        })).filter((r) => r.nome)

        if (parsed.length === 0) throw new Error('Nenhum cliente válido. Verifique se a planilha tem as colunas: Nome, Telefone, Valor, Dia de cobrança.')

        setImportRows(parsed)
        setImportDone(false)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao ler arquivo'
        setImportError(msg)
        setImportRows([])
      }
    }
    reader.onerror = () => setImportError('Não foi possível ler o arquivo.')
    reader.readAsArrayBuffer(file)
  }
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
    e.target.value = ''
  }

  async function handleImportSubmit() {
    if (!importRows.length) return
    setImportLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setImportLoading(false); return }
    const uid = session.user.id
    const toInsert = importRows.map((r) => ({
      user_id: uid,
      nome: r.nome,
      telefone: r.telefone,
      valor: parseFloat(r.valor.replace(',', '.')) || 0,
      dia_cobranca: Math.min(28, Math.max(1, parseInt(r.dia_cobranca) || 5)),
      status: 'pendente' as Status,
    }))
    const { data } = await (supabase as any).from('clientes').insert(toInsert).select()
    invalidate()
    if (data) setClientes((p) => [...(data as Cliente[]), ...p])
    setImportLoading(false)
    setImportDone(true)
    setTimeout(() => { setShowImport(false); setImportRows([]); setImportDone(false) }, 1500)
  }

  const thStyle: React.CSSProperties = {
    background: 'var(--color-surface-3)',
    color: 'var(--color-text-muted)',
    borderBottom: '1px solid var(--color-border)',
  }

  /* ── Cálculos pra banner resumo ── */
  const totalReceber = totals.pendente + totals.cobrado
  const today = new Date().getDate()
  const venceEssaSemana = clientes.filter((c) => {
    if (c.status === 'pago') return false
    const diff = c.dia_cobranca - today
    return diff >= 0 && diff <= 7
  })

  return (
    <div>
      {/* ═══ Header ═══ */}
      <header className="flex items-end justify-between gap-6 flex-wrap mb-5 pb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-px" style={{ background: 'var(--color-brand)' }} />
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: 'var(--color-brand)' }}>
              Clientes & Cobranças
            </p>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 2.6vw, 2.25rem)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>
            Cobranças
          </h1>
        </div>

        {/* Ações + data */}
        <div className="flex items-center gap-4">
          <p className="hidden md:block text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>
            {todayLabel()}
          </p>
          <div className="w-px h-8 self-center hidden md:block" style={{ background: 'var(--color-border)' }} />
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowImport(true); setImportRows([]); setImportDone(false); setImportError(null) }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-brand)'; e.currentTarget.style.borderColor = 'var(--color-brand)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.borderColor = 'var(--color-border)' }}>
              <FileSpreadsheet size={14} /> Importar
            </button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
              style={{ background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }}>
              <Plus size={14} /> Novo cliente
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Banner resumo destaque ═══ */}
      {clientes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 animate-fade-in">
          {/* A receber */}
          <div className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-brand) 8%, var(--color-surface-2)), var(--color-surface-2))', border: '1px solid color-mix(in srgb, var(--color-brand) 25%, var(--color-border))' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
                Total a receber
              </p>
              <DollarSign size={14} style={{ color: 'var(--color-brand)' }} />
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1, color: 'var(--color-brand)', letterSpacing: '-0.02em' }}>
              {fmt(totalReceber)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {clientes.filter((c) => c.status !== 'pago').length} cobrança{clientes.filter((c) => c.status !== 'pago').length !== 1 ? 's' : ''} em aberto
            </p>
          </div>

          {/* Vencendo essa semana */}
          <div className="rounded-2xl p-5"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
                Próximos 7 dias
              </p>
              <Clock size={14} style={{ color: '#f59e0b' }} />
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              {venceEssaSemana.length} <span className="text-sm font-normal" style={{ color: 'var(--color-text-muted)' }}>cliente{venceEssaSemana.length !== 1 ? 's' : ''}</span>
            </p>
            <p className="text-xs mt-1" style={{ color: '#f59e0b', fontWeight: 600 }}>
              {fmt(venceEssaSemana.reduce((a, c) => a + c.valor, 0))} pra cobrar
            </p>
          </div>

          {/* Total de clientes */}
          <div className="rounded-2xl p-5"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
                Total de clientes
              </p>
              <Users size={14} style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              {clientes.length}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {clientes.filter((c) => c.status === 'pago').length} já pagaram esse mês
            </p>
          </div>
        </div>
      )}

      {/* ═══ Tabs Cobranças/Pagamentos como nav segmented ═══ */}
      <div className="flex items-center justify-between mb-5">
        <div className="inline-flex rounded-xl p-1 gap-1" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
          {(['cobrancas', 'pagamentos'] as PageTab[]).map((tab) => (
            <button key={tab} onClick={() => setPageTab(tab)}
              className="px-5 py-2 rounded-lg text-sm font-bold transition-all active:scale-[0.96]"
              style={pageTab === tab
                ? { background: 'var(--color-surface-2)', color: 'var(--color-brand)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
                : { color: 'var(--color-text-muted)' }}>
              {tab === 'cobrancas' ? 'Cobrar Clientes' : 'Histórico de Pagamentos'}
            </button>
          ))}
        </div>

        {/* Legenda inline dos status (substitui banner amarelo) */}
        <div className="hidden md:flex items-center gap-3 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
            <strong style={{ color: 'var(--color-text)' }}>Aguardando</strong> não cobrou
          </span>
          <span style={{ color: 'var(--color-border)' }}>·</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: '#60a5fa' }} />
            <strong style={{ color: 'var(--color-text)' }}>Enviado</strong> aguardando pagamento
          </span>
          <span style={{ color: 'var(--color-border)' }}>·</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: '#16a34a' }} />
            <strong style={{ color: 'var(--color-text)' }}>Pago</strong> finalizado
          </span>
        </div>
      </div>

      {/* ═══ Stats cards ═══ */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(['pendente', 'cobrado', 'pago'] as Status[]).map((key) => {
          const cfg = STATUS_CFG[key]; const Icon = cfg.icon
          const count = clientes.filter((c) => c.status === key).length
          const isActive = filterStatus === key
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(isActive ? 'todos' : key)}
              className="relative p-5 rounded-2xl text-left transition-all hover:-translate-y-0.5 overflow-hidden group"
              style={{
                background: 'var(--color-surface-2)',
                border: `1px solid ${isActive ? cfg.color : 'var(--color-border)'}`,
                boxShadow: isActive ? `0 8px 24px -12px ${cfg.color}` : '0 1px 0 rgba(0,0,0,0.02)',
              }}
            >
              {/* Faixa lateral */}
              <span className="absolute left-0 top-5 bottom-5 w-0.75 rounded-r-full" style={{ background: cfg.color }} />

              {/* Header: label + icon */}
              <div className="flex items-center justify-between mb-3 pl-2">
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
                  {cfg.label}
                </p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `color-mix(in srgb, ${cfg.color} 12%, transparent)` }}>
                  <Icon size={14} style={{ color: cfg.color }} />
                </div>
              </div>

              {/* Número grande */}
              <div className="pl-2 flex items-baseline gap-2 mb-1">
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, lineHeight: 1, color: cfg.color, letterSpacing: '-0.02em' }}>
                  {count}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  cliente{count !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Valor total */}
              <p className="text-sm font-semibold pl-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
                {fmt(totals[key])}
              </p>

              {/* Indicador filtro ativo */}
              {isActive && (
                <span className="absolute top-3 right-3 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase"
                  style={{ background: cfg.color, color: 'white' }}>
                  Filtrado
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Aba Cobranças */}
      {pageTab === 'cobrancas' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            {/* Modo de cobrança */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] mr-1" style={{ color: 'var(--color-text-muted)' }}>
                Modo:
              </span>
              <div className="inline-flex rounded-xl p-1 gap-1" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                {([['individual', MessageSquare, 'Um por vez'], ['massa', Users, 'Em massa']] as const).map(([mode, Icon, label]) => (
                  <button key={mode} onClick={() => setChargeMode(mode)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.96]"
                    style={chargeMode === mode
                      ? { background: 'var(--color-surface-2)', color: 'var(--color-brand)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
                      : { color: 'var(--color-text-muted)' }}>
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Indicador de filtro ativo + clear */}
            {filterStatus !== 'todos' ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: `color-mix(in srgb, ${STATUS_CFG[filterStatus as Status].color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${STATUS_CFG[filterStatus as Status].color} 30%, transparent)`, color: STATUS_CFG[filterStatus as Status].color }}>
                <span>Filtrado por: {STATUS_CFG[filterStatus as Status].label}</span>
                <button onClick={() => setFilterStatus('todos')} className="ml-1 opacity-70 hover:opacity-100">
                  <X size={11} />
                </button>
              </div>
            ) : (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Mostrando todos · clique num card acima para filtrar
              </span>
            )}
          </div>

          {chargeMode === 'individual' && (
            <div className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 8px 32px -16px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center justify-between px-5 py-3.5"
                style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                    Lista de clientes
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {listaCobrar.length} {listaCobrar.length === 1 ? 'cliente' : 'clientes'} {filterStatus !== 'todos' ? `com status "${STATUS_CFG[filterStatus as Status].label.toLowerCase()}"` : 'no total'}
                  </p>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Total: <strong style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-display)' }}>
                    {fmt(listaCobrar.reduce((a, c) => a + c.valor, 0))}
                  </strong>
                </p>
              </div>
              <div className="grid text-[10px] font-bold uppercase tracking-[0.14em] px-5 py-2.5"
                style={{ ...thStyle, gridTemplateColumns: '1fr 140px 90px 120px 120px', background: 'var(--color-surface-2)' }}>
                <span>Cliente</span><span>Valor</span><span>Vencimento</span><span>Status</span><span />
              </div>
              {listaCobrar.length === 0 && (
                <div className="py-16 px-6 text-center flex flex-col items-center gap-3" style={{ background: 'var(--color-surface-2)' }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--color-brand) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-brand) 20%, transparent)' }}>
                    <Users size={20} style={{ color: 'var(--color-brand)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                      {clientes.length === 0 ? 'Nenhum cliente ainda' : 'Nenhum cliente neste filtro'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {clientes.length === 0
                        ? 'Cadastre seu primeiro cliente para começar a cobrar.'
                        : 'Tente outro status ou limpe o filtro.'}
                    </p>
                  </div>
                  {clientes.length === 0 ? (
                    <button onClick={() => setShowModal(true)}
                      className="mt-1 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                      style={{ background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }}>
                      <Plus size={13} /> Cadastrar primeiro cliente
                    </button>
                  ) : (
                    <button onClick={() => setFilterStatus('todos')}
                      className="mt-1 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                      Mostrar todos
                    </button>
                  )}
                </div>
              )}
              {listaCobrar.map((c) => {
                const isOpen = openId === c.id; const isSending = sendingId === c.id; const hasError = errorId === c.id
                return (
                  <div key={c.id}>
                    <div className="grid items-center px-5 py-3.5 text-sm transition-colors"
                      onContextMenu={(e) => openCtxMenu(e, c.id)}
                      style={{
                        gridTemplateColumns: '1fr 140px 90px 120px 120px',
                        background: isOpen ? 'color-mix(in srgb, var(--color-brand) 5%, var(--color-surface-2))' : 'var(--color-surface-2)',
                        borderBottom: '1px solid var(--color-border)',
                        borderLeft: `2px solid ${isOpen ? 'var(--color-brand)' : 'transparent'}`,
                      }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar nome={c.nome} />
                        <div className="min-w-0">
                          <p className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>{c.nome}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{c.telefone}</p>
                        </div>
                      </div>
                      <span className="font-semibold" style={{ color: 'var(--color-brand)' }}>{fmt(c.valor)}</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Dia {c.dia_cobranca}</span>
                      <StatusBadge status={c.status} />
                      <div className="flex items-center gap-1.5 ml-auto">
                        <button onClick={() => { setOpenId(isOpen ? null : c.id); setErrorId(null) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.95]"
                          style={isOpen
                            ? { background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }
                            : { background: 'var(--color-brand)', color: 'white' }}>
                          <Send size={11} />
                          {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                        <button onClick={() => deleteCliente(c.id)} title="Deletar cliente"
                          className="p-1.5 rounded-lg transition-all active:scale-[0.95]"
                          style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', background: 'var(--color-surface-3)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.borderColor = 'var(--color-border)' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="px-5 py-4"
                        style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)', borderLeft: '2px solid var(--color-brand)' }}>
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Mensagem a ser enviada — edite se necessário</p>
                        <textarea rows={3} value={getMensagem(c)}
                          onChange={(e) => setMensagens((p) => ({ ...p, [c.id]: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none mb-3"
                          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)', lineHeight: 1.6 }}
                          onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand)')}
                          onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')} />
                        {hasError && (
                          <div className="flex items-center gap-2 mb-3 text-xs px-3 py-2 rounded-lg"
                            style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                            <AlertCircle size={12} /> Falha ao enviar. Verifique a conexão.
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => cobrarUm(c)} disabled={isSending}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                            style={{ background: 'var(--color-brand)', color: 'white', opacity: isSending ? 0.7 : 1 }}>
                            {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                            {isSending ? 'Enviando...' : 'Enviar cobrança'}
                          </button>
                          <button onClick={() => { setOpenId(null); setErrorId(null) }}
                            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {chargeMode === 'massa' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                  Mensagem personalizada <span className="font-normal text-xs" style={{ color: 'var(--color-text-muted)' }}>— deixe vazio para usar a mensagem padrão de cada cliente</span>
                </p>
                <textarea rows={3} placeholder="Ex: Olá! Lembrando que sua mensalidade está disponível para pagamento..."
                  value={mensagemMassa} onChange={(e) => setMensagemMassa(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none mb-3"
                  style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text)', lineHeight: 1.6 }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')} />
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setSelectedIds(new Set(clientes.filter((c) => c.status === 'pendente').map((c) => c.id)))}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.95]"
                    style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                    Selecionar pendentes
                  </button>
                  {selectedIds.size > 0 && (
                    <button onClick={() => setSelectedIds(new Set())}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.95]"
                      style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                      Limpar
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    {sentMassa && <span className="text-xs flex items-center gap-1" style={{ color: '#34d399' }}><CheckCircle size={12} /> Enviado com sucesso!</span>}
                    <button onClick={cobrarMassa} disabled={sendingMassa || selectedIds.size === 0}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                      style={{ background: selectedIds.size === 0 ? 'var(--color-surface-3)' : 'var(--color-brand)', color: selectedIds.size === 0 ? 'var(--color-text-muted)' : 'white' }}>
                      {sendingMassa ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      {sendingMassa ? 'Enviando...' : `Enviar para ${selectedIds.size} cliente${selectedIds.size !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                <div className="grid text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ ...thStyle, gridTemplateColumns: '32px 1fr 140px 90px 120px' }}>
                  <span /><span>Cliente</span><span>Valor</span><span>Vencimento</span><span>Status</span>
                </div>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="grid items-center px-5 py-3.5"
                      style={{ gridTemplateColumns: '32px 1fr 140px 90px 120px', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                      <span className="skeleton w-4 h-4 rounded" />
                      <div className="flex items-center gap-3">
                        <span className="skeleton w-8 h-8 rounded-full shrink-0" />
                        <div className="flex flex-col gap-1.5">
                          <span className="skeleton h-3.5" style={{ width: `${80 + (i * 27) % 60}px` }} />
                          <span className="skeleton h-2.5 w-24" />
                        </div>
                      </div>
                      <span className="skeleton h-3.5 w-16" />
                      <span className="skeleton h-3.5 w-10" />
                      <span className="skeleton h-6 w-20 rounded-full" />
                    </div>
                  ))
                  : clientes.map((c, i) => (
                    <div key={c.id} className="grid items-center px-5 py-3.5 text-sm cursor-pointer transition-colors animate-fade-in"
                      style={{ gridTemplateColumns: '32px 1fr 140px 90px 120px', background: selectedIds.has(c.id) ? 'color-mix(in srgb, var(--color-brand) 7%, var(--color-surface-2))' : 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', borderLeft: `2px solid ${selectedIds.has(c.id) ? 'var(--color-brand)' : 'transparent'}`, animationDelay: `${i * 35}ms` }}
                      onClick={() => toggleSelect(c.id)}>
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)}
                        style={{ accentColor: 'var(--color-brand)' }} onClick={(e) => e.stopPropagation()} />
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar nome={c.nome} />
                        <div className="min-w-0">
                          <p className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>{c.nome}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{c.telefone}</p>
                        </div>
                      </div>
                      <span className="font-semibold" style={{ color: 'var(--color-brand)' }}>{fmt(c.valor)}</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Dia {c.dia_cobranca}</span>
                      <StatusBadge status={c.status} />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aba Pagamentos */}
      {pageTab === 'pagamentos' && (
        <div>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <div className="grid text-xs font-semibold uppercase tracking-wider px-5 py-3"
              style={{ ...thStyle, gridTemplateColumns: '1fr 140px 130px 130px' }}>
              <span>Cliente</span><span>Valor</span><span>Cobrado em</span><span>Status</span>
            </div>
            {clientes.map((c) => (
              <div key={c.id} className="grid items-center px-5 py-3.5 text-sm"
                style={{ gridTemplateColumns: '1fr 140px 130px 130px', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar nome={c.nome} />
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>{c.nome}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{c.telefone}</p>
                  </div>
                </div>
                <span className="font-semibold" style={{ color: 'var(--color-brand)' }}>{fmt(c.valor)}</span>
                <span className="text-xs" style={{ color: c.cobrado_em ? 'var(--color-text-muted)' : 'var(--color-border)' }}>{c.cobrado_em ?? '—'}</span>
                <StatusBadge status={c.status} onClick={c.status !== 'pendente' ? () => cyclePago(c) : undefined} title={c.status !== 'pendente' ? 'Clique para alternar entre Cobrado e Pago' : undefined} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 px-5 py-3 rounded-2xl text-xs"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
            <span className="flex items-center gap-1.5">
              <DollarSign size={12} style={{ color: 'var(--color-brand)' }} />
              Clique no status para alternar entre <strong style={{ color: STATUS_CFG.cobrado.color }}>Cobrado</strong> e <strong style={{ color: STATUS_CFG.pago.color }}>Pago</strong>
            </span>
            <div className="flex items-center gap-4">
              <span>Cobrado: <strong style={{ color: STATUS_CFG.cobrado.color }}>{fmt(totals.cobrado)}</strong></span>
              <span>Pago: <strong style={{ color: STATUS_CFG.pago.color }}>{fmt(totals.pago)}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null) }}>
          <div className="absolute rounded-xl overflow-hidden py-1"
            style={{ top: ctxMenu.y, left: ctxMenu.x, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: '180px' }}
            onClick={(e) => e.stopPropagation()}>
            <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Alterar status</p>
            {(['pendente', 'cobrado', 'pago'] as Status[]).map((s) => {
              const cfg = STATUS_CFG[s]; const Icon = cfg.icon
              const isCurrent = clientes.find((c) => c.id === ctxMenu.clienteId)?.status === s
              return (
                <button key={s} onClick={() => { setStatus(ctxMenu.clienteId, s); setCtxMenu(null) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all"
                  style={{ background: isCurrent ? 'color-mix(in srgb, var(--color-brand) 10%, transparent)' : 'transparent', color: isCurrent ? cfg.color : 'var(--color-text)' }}
                  onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = 'var(--color-surface-3)' }}
                  onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}>
                  <Icon size={13} style={{ color: cfg.color }} /><span>{cfg.label}</span>
                  {isCurrent && <span className="ml-auto text-xs opacity-60">atual</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal importar */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowImport(false)}>
          <div
            className="w-full max-w-xl rounded-2xl overflow-hidden animate-fade-in"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-3)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, var(--color-brand) 12%, transparent)' }}>
                  <FileSpreadsheet size={17} style={{ color: 'var(--color-brand)' }} />
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text)' }}>
                    Importar lista de clientes
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Cadastre vários clientes de uma vez através de uma planilha
                  </p>
                </div>
              </div>
              <button onClick={() => setShowImport(false)} className="p-1.5 rounded-lg transition-all"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <X size={16} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">

              {/* ── PASSO 1: Baixar modelo ── */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: 'color-mix(in srgb, var(--color-brand) 7%, transparent)', border: '1px dashed color-mix(in srgb, var(--color-brand) 35%, transparent)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{ background: 'var(--color-brand)', color: 'white' }}>1</span>
                  <div className="min-w-0">
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>Baixe o modelo CSV</p>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 1 }}>Abra no Excel ou Google Planilhas e preencha os clientes</p>
                  </div>
                </div>
                <button onClick={downloadClientesTemplate}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95 shrink-0"
                  style={{ background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }}>
                  <Download size={13} /> Baixar
                </button>
              </div>

              {/* ── PASSO 2: Formato esperado ── */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>2</span>
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>Preencha estas 4 colunas</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['Nome', 'Telefone', 'Valor', 'Dia de cobrança'].map((c, i) => (
                      <span key={c} className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                        style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>{String.fromCharCode(65 + i)}</span> · {c}
                      </span>
                    ))}
                  </div>
                  <p className="font-mono mt-2" style={{ fontSize: '11px', color: 'var(--color-brand)' }}>
                    Maria Silva,11999990000,350.00,5
                  </p>
                </div>
              </div>

              {/* ── PASSO 3: Upload ── */}
              <input ref={importInputRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={handleImportFile} />

              {importRows.length === 0 ? (
                <>
                  <button
                    onClick={() => importInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setImportDragOver(true) }}
                    onDragLeave={() => setImportDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault(); setImportDragOver(false)
                      const f = e.dataTransfer.files?.[0]; if (f) processFile(f)
                    }}
                    className="flex flex-col items-center gap-3 py-10 rounded-xl border-2 border-dashed w-full transition-all"
                    style={{
                      borderColor: importError ? '#dc2626' : importDragOver ? 'var(--color-brand)' : 'var(--color-border)',
                      color: importError ? '#dc2626' : importDragOver ? 'var(--color-brand)' : 'var(--color-text-muted)',
                      background: importDragOver ? 'color-mix(in srgb, var(--color-brand) 6%, transparent)' : 'transparent',
                    }}
                    onMouseEnter={(e) => { if (!importError && !importDragOver) { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.color = 'var(--color-brand)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--color-brand) 4%, transparent)' } }}
                    onMouseLeave={(e) => { if (!importError && !importDragOver) { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent' } }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                        style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>3</span>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>Suba o arquivo preenchido</span>
                    </div>
                    <Upload size={26} strokeWidth={1.5} />
                    <div className="text-center">
                      <p style={{ fontSize: '12px' }}>Clique aqui ou arraste o arquivo</p>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>Aceita .csv, .xlsx ou .xls</p>
                    </div>
                  </button>
                  {importError && (
                    <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-xs"
                      style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626' }}>
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold mb-0.5">Não foi possível ler o arquivo</p>
                        <p style={{ opacity: 0.85 }}>{importError}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Resumo */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#16a34a' }}>
                        <CheckCheck size={12} className="text-white" />
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
                        {importRows.length} cliente{importRows.length !== 1 ? 's' : ''} pronto{importRows.length !== 1 ? 's' : ''} pra importar
                      </span>
                    </div>
                    <button onClick={() => importInputRef.current?.click()}
                      style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-brand)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}>
                      Trocar arquivo
                    </button>
                  </div>

                  {/* Preview */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', maxHeight: 240, overflowY: 'auto' }}>
                    <table className="w-full table-fixed border-collapse text-xs">
                      <thead>
                        <tr style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
                          {['Nome', 'Telefone', 'Valor', 'Dia'].map((h, i) => (
                            <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider"
                              style={{ color: 'var(--color-text-muted)', fontSize: '10px', width: i === 0 ? 'auto' : i === 1 ? '130px' : i === 2 ? '90px' : '50px' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'var(--color-surface-2)' : 'var(--color-surface)' }}>
                            <td className="px-3 py-2 truncate font-medium" style={{ color: 'var(--color-text)' }}>{r.nome}</td>
                            <td className="px-3 py-2 truncate" style={{ color: 'var(--color-text-muted)' }}>{r.telefone || '—'}</td>
                            <td className="px-3 py-2 font-bold" style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-display)' }}>{r.valor}</td>
                            <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>{r.dia_cobranca}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Confirm */}
                  <button onClick={handleImportSubmit} disabled={importLoading || importDone}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
                    style={importDone
                      ? { background: 'rgba(22,163,74,0.1)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.3)' }
                      : { background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }}>
                    {importLoading ? <><Loader2 size={14} className="animate-spin" /> Importando...</>
                     : importDone    ? <><CheckCheck size={14} /> Importado com sucesso!</>
                     : <><Upload size={14} /> Importar {importRows.length} cliente{importRows.length !== 1 ? 's' : ''}</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal novo cliente */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setShowModal(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>Novo cliente</h2>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Nome</label>
              <input type="text" placeholder="João Silva" value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addCliente()}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Telefone</label>
              <div className="flex gap-2 relative">
                <button type="button" onClick={() => setShowCountries((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium shrink-0 transition-all active:scale-[0.97]"
                  style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                  <span>{country.flag}</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{country.code}</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>▾</span>
                </button>
                {showCountries && (
                  <div className="absolute top-full left-0 mt-1 z-10 rounded-xl overflow-hidden overflow-y-auto"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', maxHeight: '220px', minWidth: '220px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                    {COUNTRIES.map((c) => (
                      <button key={c.code + c.name} type="button"
                        onClick={() => { setCountry(c); setShowCountries(false); setForm((p) => ({ ...p, telefone: '' })) }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-all"
                        style={{ background: country.code === c.code ? 'color-mix(in srgb, var(--color-brand) 12%, transparent)' : 'transparent', color: 'var(--color-text)' }}
                        onMouseEnter={(e) => { if (country.code !== c.code) e.currentTarget.style.background = 'var(--color-surface-3)' }}
                        onMouseLeave={(e) => { if (country.code !== c.code) e.currentTarget.style.background = 'transparent' }}>
                        <span className="text-base">{c.flag}</span>
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}
                <input type="tel" placeholder={country.mask.replace(/#/g, '0')} value={form.telefone}
                  maxLength={country.max + 4}
                  onChange={(e) => { const digits = e.target.value.replace(/\D/g, '').slice(0, country.max); setForm((p) => ({ ...p, telefone: digits })) }}
                  onKeyDown={(e) => e.key === 'Enter' && addCliente()}
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')} />
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>{form.telefone.length}/{country.max} dígitos</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Valor (R$)</label>
              <input type="text" placeholder="1500,00" value={form.valor}
                onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addCliente()}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Dia de cobrança</label>
              <input type="number" placeholder="5" min={1} max={28} value={form.dia_cobranca}
                onChange={(e) => setForm((p) => ({ ...p, dia_cobranca: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addCliente()}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={addCliente} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                style={{ background: 'var(--color-brand)', color: 'white' }}>Adicionar</button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
