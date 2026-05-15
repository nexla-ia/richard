import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, X, Trash2, Plus, Upload, Download, FileSpreadsheet, CheckCheck, Loader2, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { cacheGet, cacheSet, cacheInvalidate } from '@/lib/cache'

type Gestao = { id: number; nome: string; valor: number; data: string; feito: string }
type EditingCell = { id: number; field: keyof Gestao } | null

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function monthLabel(ym: string, form: 'long' | 'short' = 'long') {
  const [y, m] = ym.split('-')
  const month = new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('pt-BR', { month: form })
  return { month: month.charAt(0).toUpperCase() + month.slice(1), year: y }
}

/* ─── Template XLSX pra Gestões ─── */
function downloadTemplate() {
  const data = [
    ['Nome',                  'Valor',  'Data',       'O que foi feito'],
    ['Consultoria Empresa X', 1500.00,  '2025-05-01', 'Reunião e análise'],
    ['Projeto Site',          800.00,   '2025-05-10', 'Desenvolvimento landing page'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 12 }, { wch: 32 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Gestões')
  XLSX.writeFile(wb, 'modelo_gestoes.xlsx')
}

/* ── Célula editável ── */
function Cell({
  row, field, display, type = 'text', accent = false,
  editing, editValue, inputRef,
  onStart, onChange, onCommit, onCancel, onTab,
}: {
  row: Gestao; field: keyof Gestao; display: string; type?: string; accent?: boolean
  editing: EditingCell; editValue: string; inputRef: React.RefObject<HTMLInputElement | null>
  onStart: (id: number, f: keyof Gestao, v: string | number) => void
  onChange: (v: string) => void; onCommit: () => void; onCancel: () => void; onTab?: () => void
}) {
  const active = editing?.id === row.id && editing?.field === field
  return (
    <td
      onClick={() => !active && onStart(row.id, field, row[field])}
      style={{
        borderRight: '1px solid var(--color-border)',
        background: active ? 'color-mix(in srgb, var(--color-brand) 6%, var(--color-surface))' : 'transparent',
        boxShadow: active ? 'inset 0 0 0 1.5px var(--color-brand)' : 'none',
        cursor: active ? 'default' : 'cell',
        transition: 'background 0.15s, box-shadow 0.15s',
      }}
    >
      {active ? (
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit()
            if (e.key === 'Escape') onCancel()
            if (e.key === 'Tab') { e.preventDefault(); onCommit(); onTab?.() }
          }}
          className="w-full px-3 py-2.5 text-sm outline-none bg-transparent"
          style={{ color: accent ? 'var(--color-brand)' : 'var(--color-text)', fontFamily: accent ? 'var(--font-display)' : 'inherit', fontWeight: accent ? 600 : 400 }}
        />
      ) : (
        <div className="px-3 py-2.5 text-sm truncate select-none">
          {display
            ? <span style={{ color: accent ? 'var(--color-brand)' : 'var(--color-text)', fontFamily: accent ? 'var(--font-display)' : 'inherit', fontWeight: accent ? 600 : 400 }}>{display}</span>
            : <span style={{ color: 'color-mix(in srgb, var(--color-border) 80%, transparent)', fontStyle: 'italic', fontSize: '11px' }}>—</span>
          }
        </div>
      )}
    </td>
  )
}

export default function GestoesPage() {
  const supabase = createClient()
  const cachedRows = cacheGet<Gestao[]>('gestoes')
  const [rows, setRows]       = useState<Gestao[]>(cachedRows ?? [])
  const [loading, setLoading] = useState(!cachedRows)
  const [search, setSearch]   = useState('')
  const [editing, setEditing] = useState<EditingCell>(null)
  const [editVal, setEditVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const allMonths = useMemo(
    () => Array.from(new Set(rows.map((r) => r.data?.slice(0, 7) ?? '').filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    [rows]
  )
  const [activeIdx, setActiveIdx] = useState(0)
  const activeMonth = allMonths[activeIdx] ?? ''

  const [showImport, setShowImport]       = useState(false)
  const [importRows, setImportRows]       = useState<Omit<Gestao, 'id'>[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importDone, setImportDone]       = useState(false)
  const [importError, setImportError]     = useState<string | null>(null)
  const [feitoModal, setFeitoModal]       = useState<{ id: number; value: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  /* ── load ── */
  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setLoading(false); return }
        const { data } = await (supabase as any).from('gestoes').select('*').eq('user_id', session.user.id).order('data', { ascending: false })
        const list = (data as Gestao[]) ?? []
        cacheSet('gestoes', list)
        setRows(list)
      } catch (err) { console.error('[Gestoes]', err) }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => { setActiveIdx(0) }, [allMonths.length])

  /* ── derived ── */
  const filtered = useMemo(() => rows.filter((r) => {
    const matchM = activeMonth ? r.data?.startsWith(activeMonth) : true
    const q = search.toLowerCase()
    return matchM && (!q || r.nome?.toLowerCase().includes(q) || r.feito?.toLowerCase().includes(q))
  }), [rows, activeMonth, search])

  const monthTotals = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((r) => {
      const ym = r.data?.slice(0, 7)
      if (ym) map.set(ym, (map.get(ym) ?? 0) + (r.valor || 0))
    })
    return map
  }, [rows])

  const maxTotal = useMemo(() => Math.max(...Array.from(monthTotals.values()), 1), [monthTotals])
  const total    = useMemo(() => filtered.reduce((a, r) => a + (r.valor || 0), 0), [filtered])

  /* ── edit ── */
  function startEdit(id: number, field: keyof Gestao, val: string | number) {
    // Campo "feito" abre modal grande (texto longo)
    if (field === 'feito') {
      setFeitoModal({ id, value: String(val ?? '') })
      return
    }
    setEditing({ id, field }); setEditVal(String(val ?? ''))
  }

  async function saveFeito() {
    if (!feitoModal) return
    const { id, value } = feitoModal
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, feito: value } : r))
    setFeitoModal(null)
    await (supabase as any).from('gestoes').update({ feito: value }).eq('id', id)
    cacheInvalidate('gestoes'); cacheInvalidate('dashboard')
  }
  async function commitEdit() {
    if (!editing) return
    let updated: Gestao | null = null
    setRows((prev) => prev.map((row) => {
      if (row.id !== editing.id) return row
      const next = { ...row }
      if (editing.field === 'valor') { const p = parseFloat(String(editVal).replace(',', '.')); next.valor = isNaN(p) ? row.valor : p }
      else (next as Record<string, unknown>)[editing.field] = editVal
      updated = next; return next
    }))
    setEditing(null)
    if (updated) {
      const { nome, valor, data, feito } = updated as Gestao
      await (supabase as any).from('gestoes').update({ nome, valor, data, feito }).eq('id', editing.id)
      cacheInvalidate('gestoes'); cacheInvalidate('dashboard')
    }
  }
  function tabNext(id: number, field: keyof Gestao) {
    // Não avança pro feito (abriria modal automaticamente — confuso)
    const fields: (keyof Gestao)[] = ['nome', 'valor', 'data']
    const next = fields[fields.indexOf(field) + 1]
    if (next) { const row = rows.find((r) => r.id === id); if (row) setTimeout(() => startEdit(id, next, row[next]), 30) }
  }

  /* ── CRUD ── */
  async function addRow() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    const date = activeMonth && !today.startsWith(activeMonth) ? `${activeMonth}-01` : today
    const { data, error } = await (supabase as any).from('gestoes').insert({ user_id: user.id, nome: '', valor: 0, data: date, feito: '' }).select().single()
    if (!error && data) {
      setRows((p) => [data as Gestao, ...p])
      cacheInvalidate('gestoes'); cacheInvalidate('dashboard')
      setTimeout(() => startEdit((data as Gestao).id, 'nome', ''), 50)
    }
  }
  async function deleteRow(id: number) {
    setRows((p) => p.filter((r) => r.id !== id))
    await (supabase as any).from('gestoes').delete().eq('id', id)
    cacheInvalidate('gestoes'); cacheInvalidate('dashboard')
  }

  /* ── import (CSV + XLSX) ── */
  function parseDateCell(v: unknown): string {
    if (v == null || v === '') return new Date().toISOString().slice(0, 10)
    // Excel data serial number
    if (typeof v === 'number') {
      const d = XLSX.SSF.parse_date_code(v)
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    }
    const s = String(v).trim()
    // ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    // DD/MM/YYYY
    const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
    if (br) return `${br[3]}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}`
    return new Date().toISOString().slice(0, 10)
  }
  function parseValueCell(v: unknown): number {
    if (typeof v === 'number') return v
    const s = String(v ?? '').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
    return parseFloat(s) || 0
  }
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const buf = ev.target?.result
        const wb  = XLSX.read(buf, { type: 'array', cellDates: false })
        const ws  = wb.Sheets[wb.SheetNames[0]]
        if (!ws) throw new Error('Planilha vazia')
        const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })

        // remove linhas vazias
        const rowsArr = matrix.filter((r) => r.some((c) => String(c ?? '').trim()))
        if (rowsArr.length === 0) throw new Error('Sem dados na planilha')

        // detecta cabeçalho (primeira linha sem número na col B/valor)
        const skipHeader = isNaN(parseFloat(String(rowsArr[0][1] ?? '').replace(',', '.')))
        const dataRows   = skipHeader ? rowsArr.slice(1) : rowsArr

        const parsed = dataRows.map((cols) => ({
          nome:  String(cols[0] ?? '').trim(),
          valor: parseValueCell(cols[1]),
          data:  parseDateCell(cols[2]),
          feito: String(cols[3] ?? '').trim(),
        })).filter((r) => r.nome)

        if (parsed.length === 0) throw new Error('Nenhuma linha válida encontrada. Verifique se o arquivo tem as colunas: Nome, Valor, Data, O que foi feito.')

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
    e.target.value = ''
  }
  async function doImport() {
    if (!importRows.length) return
    setImportLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImportLoading(false); return }
    const { data } = await (supabase as any).from('gestoes').insert(importRows.map((r) => ({ user_id: user.id, ...r }))).select()
    if (data) setRows((p) => [...(data as Gestao[]), ...p])
    setImportLoading(false); setImportDone(true)
    setTimeout(() => { setShowImport(false); setImportRows([]); setImportDone(false) }, 1500)
  }

  /* ══════════════════════════════════════════════════════ RENDER ══ */
  return (
    <div className="flex flex-col h-full gap-0" style={{ minHeight: 0 }}>

      {/* ── Top bar ── */}
      <div className="flex items-end justify-between pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--color-brand)', letterSpacing: '0.2em' }}>
            Gestão Financeira
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 800, lineHeight: 1, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            Gestões
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Registre cada trabalho feito — nome do cliente, valor cobrado, data e o que foi feito.
          </p>
        </div>

        {/* Total + ações */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
              {activeMonth && <> · <span className="capitalize">{monthLabel(activeMonth).month}</span></>}
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-brand)', lineHeight: 1 }}>
              {fmt(total)}
            </p>
          </div>
          <div className="w-px h-10 self-center" style={{ background: 'var(--color-border)' }} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowImport(true); setImportRows([]); setImportDone(false); setImportError(null) }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-brand)'; e.currentTarget.style.borderColor = 'var(--color-brand)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.borderColor = 'var(--color-border)' }}
            >
              <Upload size={14} /> Importar
            </button>
            <button
              onClick={addRow}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
              style={{ background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 20px color-mix(in srgb, var(--color-brand) 35%, transparent)' }}
            >
              <Plus size={14} /> Nova linha
            </button>
          </div>
        </div>
      </div>

      {/* ── Layout split ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── Sidebar de meses ── */}
        <aside className="w-56 shrink-0 flex flex-col rounded-2xl overflow-hidden"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>

          {/* Header sidebar */}
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-text-muted)' }}>
              Períodos
            </p>
            {allMonths.length > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                {allMonths.length}
              </span>
            )}
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--color-surface-3)' }}>
                    <span className="skeleton h-3 w-16 block mb-1.5" />
                    <span className="skeleton h-2 w-full block rounded-full mb-1.5" />
                    <span className="skeleton h-3 w-20 block" />
                  </div>
                ))
              : allMonths.length === 0
              ? (
                <div className="flex flex-col items-center justify-center py-10 px-2 text-center">
                  <span className="text-2xl mb-2 opacity-40">📅</span>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Nenhum período</p>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>Adicione uma linha para começar</p>
                </div>
              )
              : allMonths.map((ym, i) => {
                  const { month, year } = monthLabel(ym)
                  const t = monthTotals.get(ym) ?? 0
                  const pct = Math.max(4, Math.round((t / maxTotal) * 100))
                  const isActive = i === activeIdx
                  return (
                    <button
                      key={ym}
                      onClick={() => setActiveIdx(i)}
                      className="text-left rounded-xl px-3 py-2.5 transition-all relative group"
                      style={{
                        background: isActive ? 'var(--color-brand)' : 'transparent',
                        boxShadow: isActive ? '0 4px 12px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' : 'none',
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--color-surface-3)' }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                    >
                      {/* Topo: mês + ano */}
                      <div className="flex items-baseline justify-between mb-2">
                        <p className="text-sm font-bold leading-none capitalize"
                          style={{ fontFamily: 'var(--font-display)', color: isActive ? 'white' : 'var(--color-text)', letterSpacing: '-0.01em' }}>
                          {month}
                        </p>
                        <span className="text-[10px] font-medium" style={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)' }}>
                          {year}
                        </span>
                      </div>

                      {/* Mini barra de progresso */}
                      <div className="h-1 rounded-full overflow-hidden mb-2"
                        style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-surface-3)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: isActive ? 'white' : 'var(--color-brand)',
                            opacity: isActive ? 0.9 : 0.6,
                          }} />
                      </div>

                      {/* Total + contagem */}
                      <div className="flex items-baseline justify-between">
                        <p className="text-sm font-bold leading-none"
                          style={{ fontFamily: 'var(--font-display)', color: isActive ? 'white' : 'var(--color-brand)' }}>
                          {fmt(t)}
                        </p>
                      </div>
                    </button>
                  )
                })}
          </div>
        </aside>

        {/* ── Painel principal ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>

          {/* Barra de busca */}
          <div className="px-4 pt-3 pb-2" style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none transition-all"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded" style={{ color: 'var(--color-text-muted)' }}>
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Cabeçalho da tabela */}
          <div style={{ background: 'var(--color-surface-3)', borderBottom: '2px solid var(--color-brand)', opacity: 1 }}>
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col style={{ width: '28px' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '108px' }} />
                <col />
                <col style={{ width: '36px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="py-2.5 text-center" style={{ borderRight: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--color-border)', fontWeight: 600 }}>#</span>
                  </th>
                  {['Nome / Cliente', 'Valor', 'Data', 'O que foi feito'].map((h, i) => (
                    <th key={h} className="px-3 py-2.5 text-left" style={{ borderRight: i < 3 ? '1px solid var(--color-border)' : 'none', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      {h}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
            </table>
          </div>

          {/* Corpo scrollável */}
          <div className="flex-1 overflow-y-auto" style={{ background: 'var(--color-surface-2)' }}>
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col style={{ width: '28px' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '108px' }} />
                <col />
                <col style={{ width: '36px' }} />
              </colgroup>
              <tbody>
                {loading ? (
                  Array.from({ length: 7 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ borderRight: '1px solid var(--color-border)', padding: '12px 0', textAlign: 'center' }}><span className="skeleton h-3 w-4 mx-auto block" /></td>
                      {[`${70 + (i * 41) % 80}px`, '56px', '48px', `${50 + (i * 29) % 100}px`].map((w, j) => (
                        <td key={j} style={{ borderRight: j < 3 ? '1px solid var(--color-border)' : 'none', padding: '12px' }}><span className="skeleton h-3.5 block" style={{ width: w }} /></td>
                      ))}
                      <td />
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                          <FileSpreadsheet size={24} style={{ color: 'var(--color-text-muted)' }} />
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-sm mb-1" style={{ color: 'var(--color-text)' }}>
                            {search ? 'Nenhum resultado' : 'Sem registros neste mês'}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {search ? 'Tente outro termo de busca.' : 'Adicione uma linha ou importe uma planilha.'}
                          </p>
                        </div>
                        {!search && (
                          <button onClick={addRow} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                            style={{ background: 'var(--color-brand)', color: 'white' }}>
                            <Plus size={14} /> Nova linha
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, i) => (
                    <tr
                      key={row.id}
                      className="group animate-fade-in"
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        animationDelay: `${Math.min(i * 18, 180)}ms`,
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => { if (!editing || editing.id !== row.id) (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--color-brand) 3%, var(--color-surface-2))' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      {/* # */}
                      <td className="text-center select-none" style={{ borderRight: '1px solid var(--color-border)', padding: '0', fontSize: '10px', color: 'color-mix(in srgb, var(--color-border) 70%, transparent)' }}>
                        {i + 1}
                      </td>

                      <Cell row={row} field="nome"  display={row.nome}                           editing={editing} editValue={editVal} inputRef={inputRef} onStart={startEdit} onChange={setEditVal} onCommit={commitEdit} onCancel={() => setEditing(null)} onTab={() => tabNext(row.id, 'nome')} />
                      <Cell row={row} field="valor" display={row.valor ? fmt(row.valor) : ''}    editing={editing} editValue={editVal} inputRef={inputRef} onStart={startEdit} onChange={setEditVal} onCommit={commitEdit} onCancel={() => setEditing(null)} onTab={() => tabNext(row.id, 'valor')} type="number" accent />
                      <Cell row={row} field="data"  display={fmtDate(row.data)}                  editing={editing} editValue={editVal} inputRef={inputRef} onStart={startEdit} onChange={setEditVal} onCommit={commitEdit} onCancel={() => setEditing(null)} onTab={() => tabNext(row.id, 'data')} type="date" />
                      <Cell row={row} field="feito" display={row.feito}                          editing={editing} editValue={editVal} inputRef={inputRef} onStart={startEdit} onChange={setEditVal} onCommit={commitEdit} onCancel={() => setEditing(null)} />

                      {/* Delete */}
                      <td className="text-center" style={{ padding: 0 }}>
                        <button
                          onClick={() => deleteRow(row.id)}
                          className="opacity-0 group-hover:opacity-50 hover:opacity-100! transition-all active:scale-90 rounded-lg p-1"
                          style={{ color: '#f87171' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--color-surface-3)', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {filtered.length} linha{filtered.length !== 1 ? 's' : ''}
              {search && ' · filtrado'}
            </span>
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all"
              style={{ fontSize: '11px', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.color = 'var(--color-brand)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)' }}
            >
              <Plus size={12} /> Adicionar linha
            </button>
          </div>
        </div>
      </div>

      {/* ══ Modal: editar "O que foi feito" ══ */}
      {feitoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setFeitoModal(null)}>
          <div className="w-full max-w-xl rounded-2xl overflow-hidden animate-fade-in"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-3)' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text)' }}>
                  Descrição do trabalho
                </p>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Detalhe o que foi feito — sem limite de tamanho
                </p>
              </div>
              <button onClick={() => setFeitoModal(null)} className="p-1.5 rounded-lg transition-all"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <textarea
                autoFocus
                value={feitoModal.value}
                onChange={(e) => setFeitoModal({ ...feitoModal, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { e.preventDefault(); setFeitoModal(null) }
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveFeito() }
                }}
                placeholder="Ex.: Ensaio fotográfico de família, 2h de sessão, 50 fotos editadas, entrega em galeria online…"
                rows={8}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y leading-relaxed"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', minHeight: 160 }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-brand) 12%, transparent)' }}
                onBlur={(e)  => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
              />
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {feitoModal.value.length} caracteres
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <kbd style={{ background: 'var(--color-surface-3)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>Ctrl + Enter</kbd> salvar
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 flex items-center justify-end gap-2"
              style={{ background: 'var(--color-surface-3)', borderTop: '1px solid var(--color-border)' }}>
              <button onClick={() => setFeitoModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'transparent', color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                Cancelar
              </button>
              <button onClick={saveFeito}
                className="px-5 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
                style={{ background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }}>
                Salvar descrição
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Importar ══ */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowImport(false)}>
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden animate-fade-in"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>Importar Planilha</p>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 2 }}>CSV · colunas: Nome, Valor, Data, O que foi feito</p>
              </div>
              <button onClick={() => setShowImport(false)} className="p-1.5 rounded-lg transition-all"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <X size={16} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {/* Template */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: 'color-mix(in srgb, var(--color-brand) 7%, var(--color-surface-2))', border: '1px dashed color-mix(in srgb, var(--color-brand) 35%, transparent)' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Modelo CSV</p>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>Baixe, preencha e suba o arquivo</p>
                </div>
                <button onClick={downloadTemplate}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background: 'var(--color-brand)', color: 'white' }}>
                  <Download size={13} /> Baixar
                </button>
              </div>

              {/* Upload */}
              <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={handleFile} />

              {importRows.length === 0 ? (
                <>
                  <button onClick={() => fileRef.current?.click()}
                    className="flex flex-col items-center gap-3 py-12 rounded-xl border-2 border-dashed w-full transition-all"
                    style={{ borderColor: importError ? '#dc2626' : 'var(--color-border)', color: importError ? '#dc2626' : 'var(--color-text-muted)' }}
                    onMouseEnter={(e) => { if (!importError) { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.color = 'var(--color-brand)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--color-brand) 4%, transparent)' } }}
                    onMouseLeave={(e) => { if (!importError) { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent' } }}>
                    <Upload size={28} strokeWidth={1.5} />
                    <div className="text-center">
                      <p style={{ fontSize: '13px', fontWeight: 600 }}>Selecionar arquivo</p>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>.csv, .xlsx ou .xls</p>
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{importRows.length} linha{importRows.length !== 1 ? 's' : ''}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: 'color-mix(in srgb, var(--color-brand) 15%, transparent)', color: 'var(--color-brand)' }}>
                        {fmt(importRows.reduce((a, r) => a + r.valor, 0))}
                      </span>
                    </div>
                    <button onClick={() => fileRef.current?.click()} style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-brand)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}>
                      Trocar arquivo
                    </button>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', maxHeight: 200, overflowY: 'auto' }}>
                    <table className="w-full table-fixed border-collapse text-xs">
                      <thead>
                        <tr style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
                          {['Nome', 'Valor', 'Data', 'Descrição'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'var(--color-surface-2)' : 'var(--color-surface)' }}>
                            <td className="px-3 py-2 truncate font-medium" style={{ color: 'var(--color-text)' }}>{r.nome}</td>
                            <td className="px-3 py-2 font-bold" style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-display)' }}>{fmt(r.valor)}</td>
                            <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>{fmtDate(r.data)}</td>
                            <td className="px-3 py-2 truncate" style={{ color: 'var(--color-text-muted)' }}>{r.feito || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={doImport} disabled={importLoading || importDone}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                    style={importDone
                      ? { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
                      : { background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 20px color-mix(in srgb, var(--color-brand) 30%, transparent)' }}>
                    {importLoading ? <><Loader2 size={14} className="animate-spin" /> Importando...</>
                     : importDone    ? <><CheckCheck size={14} /> Importado!</>
                     : <><Upload size={14} /> Importar {importRows.length} linha{importRows.length !== 1 ? 's' : ''}</>}
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
