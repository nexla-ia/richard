import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cacheGet, cacheSet, cacheInvalidate } from '@/lib/cache'
import {
  Users, Plus, Search, X, Trash2, Phone, Calendar,
  Pencil, Loader2, CheckCircle2, AlertCircle,
  FileSpreadsheet, Download, Upload, CheckCheck,
} from 'lucide-react'
import * as XLSX from 'xlsx'

/* ─── Template XLSX pra Clientes ─── */
function downloadClientesTemplate() {
  const data = [
    ['Nome',         'Telefone',    'Valor', 'Dia de cobrança'],
    ['Maria Silva',  '11999990000', 350.00,  5],
    ['João Pereira', '21988887777', 500.00,  10],
    ['Ana Costa',    '31977776666', 250.00,  15],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 10 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
  XLSX.writeFile(wb, 'modelo_clientes.xlsx')
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

const STATUS_CFG: Record<Status, { label: string; color: string }> = {
  pendente: { label: 'Aguardando', color: '#f59e0b' },
  cobrado:  { label: 'Enviado',    color: '#60a5fa' },
  pago:     { label: 'Pago',       color: '#16a34a' },
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default function ClientesPage() {
  const supabase = createClient()
  const cached = cacheGet<Cliente[]>('clientes')
  const [clientes, setClientes] = useState<Cliente[]>(cached ?? [])
  const [loading, setLoading]   = useState(!cached)
  const [search, setSearch]     = useState('')

  /* Modal cadastro/edição */
  const [modal, setModal] = useState<{ mode: 'new' | 'edit'; data: Partial<Cliente> } | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  /* Import */
  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState<{ nome: string; telefone: string; valor: number; dia_cobranca: number }[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importDragOver, setImportDragOver] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  function processClienteFile(file: File) {
    setImportError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const buf = ev.target?.result
        const wb = XLSX.read(buf, { type: 'array', cellDates: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        if (!ws) throw new Error('Planilha vazia')
        const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
        const rowsArr = matrix.filter((r) => r.some((c) => String(c ?? '').trim()))
        if (rowsArr.length === 0) throw new Error('Sem dados na planilha')
        const skipHeader = isNaN(parseFloat(String(rowsArr[0][2] ?? '').replace(',', '.')))
        const dataRows = skipHeader ? rowsArr.slice(1) : rowsArr
        const parsed = dataRows.map((cols) => {
          const valorRaw = String(cols[2] ?? '').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
          const valorNum = parseFloat(valorRaw) || 0
          const diaNum = Math.min(28, Math.max(1, parseInt(String(cols[3] ?? '5')) || 5))
          return {
            nome: String(cols[0] ?? '').trim(),
            telefone: String(cols[1] ?? '').trim().replace(/\D/g, ''),
            valor: valorNum,
            dia_cobranca: diaNum,
          }
        }).filter((r) => r.nome)
        if (parsed.length === 0) throw new Error('Nenhum cliente válido. Confira: Nome, Telefone, Valor, Dia de cobrança')
        setImportRows(parsed)
        setImportDone(false)
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Erro ao ler arquivo')
        setImportRows([])
      }
    }
    reader.onerror = () => setImportError('Não foi possível ler o arquivo.')
    reader.readAsArrayBuffer(file)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) processClienteFile(f)
    e.target.value = ''
  }

  async function doImport() {
    if (!importRows.length) return
    setImportLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada')
      const toInsert = importRows.map((r) => ({
        user_id: user.id,
        nome: r.nome,
        telefone: r.telefone,
        valor: r.valor,
        dia_cobranca: r.dia_cobranca,
        status: 'pendente',
      }))
      const { data } = await (supabase as any).from('clientes').insert(toInsert).select()
      if (data) {
        const updated = [...(data as Cliente[]), ...clientes]
        setClientes(updated); cacheSet('clientes', updated)
      }
      invalidate()
      setImportDone(true)
      setTimeout(() => { setShowImport(false); setImportRows([]); setImportDone(false) }, 1500)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Erro ao importar')
    }
    setImportLoading(false)
  }

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setLoading(false); return }
        const { data } = await (supabase as any).from('clientes').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
        const list = (data as Cliente[]) ?? []
        cacheSet('clientes', list)
        setClientes(list)
      } catch (err) { console.error('[Clientes]', err) }
      setLoading(false)
    }
    load()
  }, [])

  function invalidate() { cacheInvalidate('clientes'); cacheInvalidate('dashboard') }

  /* Filtragem */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter((c) =>
      c.nome.toLowerCase().includes(q) ||
      c.telefone.toLowerCase().includes(q)
    )
  }, [clientes, search])

  /* Stats */
  const total      = clientes.length
  const valorTotal = clientes.reduce((a, c) => a + c.valor, 0)
  const ativos     = clientes.filter((c) => c.status !== 'pago').length

  /* CRUD */
  async function saveCliente() {
    if (!modal) return
    const { nome, telefone, valor, dia_cobranca } = modal.data
    if (!nome?.trim()) { setFormError('Nome é obrigatório.'); return }
    const valorNum = parseFloat(String(valor ?? '0').replace(',', '.'))
    if (isNaN(valorNum) || valorNum <= 0) { setFormError('Valor inválido.'); return }
    const diaNum = Math.min(28, Math.max(1, Number(dia_cobranca) || 5))

    setFormError(null)
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada')

      if (modal.mode === 'new') {
        const { data, error } = await (supabase as any).from('clientes').insert({
          user_id: user.id,
          nome: nome.trim(),
          telefone: (telefone ?? '').trim(),
          valor: valorNum,
          dia_cobranca: diaNum,
          status: 'pendente',
        }).select().single()
        if (error) throw error
        if (data) setClientes((p) => [data as Cliente, ...p])
      } else {
        const id = modal.data.id
        const { error } = await (supabase as any).from('clientes').update({
          nome: nome.trim(),
          telefone: (telefone ?? '').trim(),
          valor: valorNum,
          dia_cobranca: diaNum,
        }).eq('id', id)
        if (error) throw error
        setClientes((p) => p.map((c) => c.id === id ? { ...c, nome: nome.trim(), telefone: (telefone ?? '').trim(), valor: valorNum, dia_cobranca: diaNum } : c))
      }
      invalidate()
      setModal(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar')
    }
    setSaving(false)
  }

  async function deleteCliente(c: Cliente) {
    if (!confirm(`Excluir ${c.nome}? Esta ação não pode ser desfeita.`)) return
    // Primeiro deleta no DB, só remove da UI se sucesso
    const { error } = await (supabase as any).from('clientes').delete().eq('id', c.id)
    if (error) {
      alert(`Erro ao excluir: ${error.message}`)
      return
    }
    setClientes((p) => p.filter((x) => x.id !== c.id))
    invalidate()
  }

  /* ──────── RENDER ──────── */
  return (
    <div>
      {/* Header */}
      <header className="flex items-end justify-between gap-6 flex-wrap mb-6 pb-5"
        style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-px" style={{ background: 'var(--color-brand)' }} />
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: 'var(--color-brand)' }}>
              Cadastro de Clientes
            </p>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 2.6vw, 2.25rem)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>
            Clientes
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Gerencie todos os seus clientes. Use a aba <strong style={{ color: 'var(--color-text)' }}>Cobranças</strong> para enviar mensagens.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowImport(true); setImportRows([]); setImportError(null); setImportDone(false) }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-brand)'; e.currentTarget.style.borderColor = 'var(--color-brand)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.borderColor = 'var(--color-border)' }}>
            <FileSpreadsheet size={14} /> Importar
          </button>
          <button
            onClick={() => { setModal({ mode: 'new', data: { dia_cobranca: 5 } }); setFormError(null) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
            style={{ background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }}>
            <Plus size={14} /> Novo cliente
          </button>
        </div>
      </header>

      {/* Stats compactos */}
      {clientes.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-in">
          <StatCard label="Total cadastrado" value={total} color="var(--color-brand)" hint={`${ativos} ativos`} />
          <StatCard label="Valor total" value={fmt(valorTotal)} color="var(--color-text)" hint="soma de todas as mensalidades" />
          <StatCard label="Pagos esse mês" value={clientes.filter((c) => c.status === 'pago').length} color="#16a34a" hint={`${fmt(clientes.filter((c) => c.status === 'pago').reduce((a, c) => a + c.valor, 0))} recebido`} />
        </div>
      )}

      {/* Busca */}
      <div className="mb-4 relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar por nome ou telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none transition-all"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-brand) 10%, transparent)' }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 8px 32px -16px rgba(0,0,0,0.06)' }}>

        {/* Header lista */}
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
            Lista de clientes
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'}
            {search && ` (filtrado de ${clientes.length})`}
          </p>
        </div>

        {/* Colunas */}
        {filtered.length > 0 && (
          <div className="grid text-[10px] font-bold uppercase tracking-[0.14em] px-5 py-2.5"
            style={{ gridTemplateColumns: '1fr 160px 110px 110px 60px', background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
            <span>Nome</span>
            <span>Telefone</span>
            <span>Valor</span>
            <span>Vencimento</span>
            <span />
          </div>
        )}

        {/* Linhas */}
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="grid items-center gap-2 px-5 py-3.5"
                style={{ gridTemplateColumns: '1fr 160px 110px 110px 60px', borderBottom: '1px solid var(--color-border)' }}>
                <span className="skeleton h-4 w-32" />
                <span className="skeleton h-3 w-28" />
                <span className="skeleton h-4 w-20" />
                <span className="skeleton h-3 w-16" />
                <span />
              </div>
            ))
          : filtered.length === 0 ? (
            <div className="py-16 px-6 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--color-brand) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-brand) 20%, transparent)' }}>
                <Users size={20} style={{ color: 'var(--color-brand)' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                  {clientes.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum resultado'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {clientes.length === 0
                    ? 'Comece cadastrando seus clientes para depois enviar cobranças.'
                    : 'Tente buscar por outro termo.'}
                </p>
              </div>
              {clientes.length === 0 ? (
                <button onClick={() => { setModal({ mode: 'new', data: { dia_cobranca: 5 } }); setFormError(null) }}
                  className="mt-1 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }}>
                  <Plus size={13} /> Cadastrar primeiro cliente
                </button>
              ) : (
                <button onClick={() => setSearch('')}
                  className="mt-1 px-4 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                  Limpar busca
                </button>
              )}
            </div>
          ) : filtered.map((c, i) => {
            const cfg = STATUS_CFG[c.status]
            return (
              <div key={c.id}
                className="grid items-center gap-2 px-5 py-3.5 text-sm transition-colors group animate-fade-in"
                style={{
                  gridTemplateColumns: '1fr 160px 110px 110px 60px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none',
                  animationDelay: `${Math.min(i * 25, 200)}ms`,
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-3)'}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}>

                {/* Nome + status */}
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar nome={c.nome} />
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>{c.nome}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mt-0.5 px-1.5 py-0.5 rounded"
                      style={{ background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`, color: cfg.color, border: `1px solid color-mix(in srgb, ${cfg.color} 25%, transparent)` }}>
                      <span className="w-1 h-1 rounded-full" style={{ background: cfg.color }} />
                      {cfg.label}
                    </span>
                  </div>
                </div>

                {/* Telefone */}
                <span className="text-xs flex items-center gap-1.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                  <Phone size={11} style={{ color: 'var(--color-text-muted)' }} />
                  {c.telefone || <span style={{ color: 'var(--color-border)', fontStyle: 'italic' }}>sem telefone</span>}
                </span>

                {/* Valor */}
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-brand)' }}>
                  {fmt(c.valor)}
                </span>

                {/* Vencimento */}
                <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  <Calendar size={11} /> Dia {c.dia_cobranca}
                </span>

                {/* Ações */}
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setModal({ mode: 'edit', data: c }); setFormError(null) }}
                    title="Editar"
                    className="p-1.5 rounded-lg transition-all"
                    style={{ color: 'var(--color-text-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-2)'; e.currentTarget.style.color = 'var(--color-brand)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)' }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteCliente(c)}
                    title="Excluir"
                    className="p-1.5 rounded-lg transition-all"
                    style={{ color: '#dc2626' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220,38,38,0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
      </div>

      {/* ─── Modal cadastro/edição ─── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setModal(null)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden animate-fade-in"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}>

            <div className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-3)' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem' }}>
                  {modal.mode === 'new' ? 'Novo cliente' : 'Editar cliente'}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Preencha os dados abaixo
                </p>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg"
                style={{ color: 'var(--color-text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <Field label="Nome do cliente" required>
                <input
                  autoFocus type="text" placeholder="Ex.: Maria Silva"
                  value={modal.data.nome ?? ''}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, nome: e.target.value } })}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'var(--color-surface), border: 1px solid var(--color-border)', color: 'var(--color-text)' } as any}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-brand) 12%, transparent)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
                />
              </Field>
              <Field label="Telefone (com DDD)">
                <input
                  type="tel" placeholder="11999990000"
                  value={modal.data.telefone ?? ''}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, telefone: e.target.value.replace(/\D/g, '') } })}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-brand) 12%, transparent)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor (R$)" required>
                  <input
                    type="text" placeholder="350,00"
                    value={modal.data.valor ?? ''}
                    onChange={(e) => setModal({ ...modal, data: { ...modal.data, valor: e.target.value as any } })}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)' }}
                  />
                </Field>
                <Field label="Dia do mês" required>
                  <input
                    type="number" min={1} max={28} placeholder="5"
                    value={modal.data.dia_cobranca ?? 5}
                    onChange={(e) => setModal({ ...modal, data: { ...modal.data, dia_cobranca: Number(e.target.value) } })}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)' }}
                  />
                </Field>
              </div>

              {formError && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs"
                  style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626' }}>
                  <AlertCircle size={13} className="shrink-0 mt-0.5" /> {formError}
                </div>
              )}
            </div>

            <div className="px-6 py-3 flex items-center justify-end gap-2"
              style={{ background: 'var(--color-surface-3)', borderTop: '1px solid var(--color-border)' }}>
              <button onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'transparent', color: 'var(--color-text-muted)' }}>
                Cancelar
              </button>
              <button onClick={saveCliente} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
                style={{ background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }}>
                {saving
                  ? <><Loader2 size={13} className="animate-spin" /> Salvando...</>
                  : <><CheckCircle2 size={13} /> {modal.mode === 'new' ? 'Cadastrar' : 'Salvar alterações'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Importar Planilha ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowImport(false)}>
          <div className="w-full max-w-xl rounded-2xl overflow-hidden animate-fade-in"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}>

            <div className="px-6 py-4 flex items-center justify-between"
              style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
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
              <button onClick={() => setShowImport(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {/* PASSO 1: Baixar */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: 'color-mix(in srgb, var(--color-brand) 7%, transparent)', border: '1px dashed color-mix(in srgb, var(--color-brand) 35%, transparent)' }}>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{ background: 'var(--color-brand)', color: 'white' }}>1</span>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>Baixe o modelo</p>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 1 }}>Abra no Excel ou Google Planilhas e preencha</p>
                  </div>
                </div>
                <button onClick={downloadClientesTemplate}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }}>
                  <Download size={13} /> Baixar
                </button>
              </div>

              {/* PASSO 2: Formato */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>2</span>
                <div className="flex-1">
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

              {/* PASSO 3: Upload */}
              <input ref={importInputRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={handleImportFile} />

              {importRows.length === 0 ? (
                <>
                  <div
                    onClick={() => importInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setImportDragOver(true) }}
                    onDragLeave={() => setImportDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault(); setImportDragOver(false)
                      const f = e.dataTransfer.files?.[0]; if (f) processClienteFile(f)
                    }}
                    className="flex flex-col items-center gap-3 py-10 rounded-xl border-2 border-dashed cursor-pointer transition-all"
                    style={{
                      borderColor: importError ? '#dc2626' : importDragOver ? 'var(--color-brand)' : 'var(--color-border)',
                      color: importError ? '#dc2626' : importDragOver ? 'var(--color-brand)' : 'var(--color-text-muted)',
                      background: importDragOver ? 'color-mix(in srgb, var(--color-brand) 6%, transparent)' : 'transparent',
                    }}>
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
                  </div>
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
                      style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Trocar arquivo
                    </button>
                  </div>

                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', maxHeight: 220, overflowY: 'auto' }}>
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
                          <tr key={i} style={{ borderBottom: i < importRows.length - 1 ? '1px solid var(--color-border)' : 'none', background: i % 2 === 0 ? 'var(--color-surface-2)' : 'var(--color-surface)' }}>
                            <td className="px-3 py-2 truncate font-medium" style={{ color: 'var(--color-text)' }}>{r.nome}</td>
                            <td className="px-3 py-2 truncate" style={{ color: 'var(--color-text-muted)' }}>{r.telefone || '—'}</td>
                            <td className="px-3 py-2 font-bold" style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-display)' }}>
                              {r.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>{r.dia_cobranca}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button onClick={doImport} disabled={importLoading || importDone}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
                    style={importDone
                      ? { background: 'rgba(22,163,74,0.12)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.3)' }
                      : { background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }}>
                    {importLoading ? <><Loader2 size={15} className="animate-spin" /> Importando...</>
                     : importDone ? <><CheckCheck size={15} /> Importado!</>
                     : <><Upload size={15} /> Importar {importRows.length} cliente{importRows.length !== 1 ? 's' : ''}</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── helpers ─── */
function StatCard({ label, value, hint, color }: { label: string; value: string | number; hint: string; color: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
      <p className="text-[10px] font-bold tracking-[0.18em] uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1, color, letterSpacing: '-0.02em' }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>
    </div>
  )
}

function Avatar({ nome }: { nome: string }) {
  const initials = nome.trim().split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: 'color-mix(in srgb, var(--color-brand) 10%, transparent)', color: 'var(--color-brand)', border: '1px solid color-mix(in srgb, var(--color-brand) 20%, transparent)' }}>
      {initials || '?'}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
        {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      {children}
    </div>
  )
}
