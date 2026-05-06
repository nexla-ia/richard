import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, X, Trash2, Plus, Upload, Download, FileSpreadsheet, CheckCheck, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

const CSV_TEMPLATE = `Nome,Valor,Data,O que foi feito\nConsultoria Empresa X,1500.00,2025-05-01,Reunião e análise\nProjeto Site,800.00,2025-05-10,Desenvolvimento landing page`

function downloadTemplate() {
  const blob = new Blob(['﻿' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'modelo_gestoes.csv'; a.click()
  URL.revokeObjectURL(url)
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
  const [rows, setRows]       = useState<Gestao[]>([])
  const [loading, setLoading] = useState(true)
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
  const fileRef = useRef<HTMLInputElement>(null)

  /* ── load ── */
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase.from('gestoes').select('*').eq('user_id', session.user.id).order('data', { ascending: false })
      if (data?.length) setRows(data as Gestao[])
      setLoading(false)
    }
    load()
    const ch = supabase.channel('gestoes-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'gestoes' }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
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
    setEditing({ id, field }); setEditVal(String(val ?? ''))
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
    if (updated) { const { nome, valor, data, feito } = updated as Gestao; await (supabase as any).from('gestoes').update({ nome, valor, data, feito }).eq('id', editing.id) }
  }
  function tabNext(id: number, field: keyof Gestao) {
    const fields: (keyof Gestao)[] = ['nome', 'valor', 'data', 'feito']
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
    if (!error && data) { setRows((p) => [data as Gestao, ...p]); setTimeout(() => startEdit((data as Gestao).id, 'nome', ''), 50) }
  }
  async function deleteRow(id: number) {
    setRows((p) => p.filter((r) => r.id !== id))
    await supabase.from('gestoes').delete().eq('id', id)
  }

  /* ── import ── */
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      const start = isNaN(parseFloat(lines[0]?.split(/[,;]/)[1]?.replace(',', '.'))) ? 1 : 0
      const parsed = lines.slice(start).map((line) => {
        const cols = line.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ''))
        return { nome: cols[0] ?? '', valor: parseFloat((cols[1] ?? '0').replace(',', '.')) || 0, data: cols[2] ?? new Date().toISOString().slice(0, 10), feito: cols[3] ?? '' }
      }).filter((r) => r.nome)
      setImportRows(parsed); setImportDone(false)
    }
    reader.readAsText(file); e.target.value = ''
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
      <div className="flex items-end justify-between pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--color-brand)', letterSpacing: '0.2em' }}>
            Gestão Financeira
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 800, lineHeight: 1, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            Gestões
          </h1>
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
              onClick={() => { setShowImport(true); setImportRows([]); setImportDone(false) }}
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
        <div className="w-48 shrink-0 flex flex-col gap-1 overflow-y-auto pr-1"
          style={{ scrollbarWidth: 'none' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] px-1 mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Períodos
          </p>
          {allMonths.length === 0 && !loading && (
            <p className="text-xs px-2" style={{ color: 'var(--color-border)' }}>Sem registros</p>
          )}
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl px-3 py-3 animate-pulse" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', opacity: 1 - i * 0.2 }}>
                  <span className="skeleton h-3 w-16 block mb-2" />
                  <span className="skeleton h-2.5 w-20 block mb-2" />
                  <span className="skeleton h-1 w-full block rounded-full" />
                </div>
              ))
            : allMonths.map((ym, i) => {
                const { month, year } = monthLabel(ym)
                const t = monthTotals.get(ym) ?? 0
                const pct = Math.round((t / maxTotal) * 100)
                const isActive = i === activeIdx
                return (
                  <button
                    key={ym}
                    onClick={() => setActiveIdx(i)}
                    className="text-left rounded-xl px-3 py-3 transition-all relative overflow-hidden"
                    style={{
                      background: isActive ? 'color-mix(in srgb, var(--color-brand) 12%, var(--color-surface-2))' : 'var(--color-surface-2)',
                      border: `1px solid ${isActive ? 'color-mix(in srgb, var(--color-brand) 50%, transparent)' : 'var(--color-border)'}`,
                      boxShadow: isActive ? '0 0 16px color-mix(in srgb, var(--color-brand) 15%, transparent)' : 'none',
                    }}
                  >
                    {/* Barra de progresso de fundo */}
                    <div className="absolute inset-0 left-0 pointer-events-none"
                      style={{ width: `${pct}%`, background: isActive ? 'color-mix(in srgb, var(--color-brand) 6%, transparent)' : 'color-mix(in srgb, var(--color-border) 30%, transparent)', transition: 'width 0.4s ease' }} />

                    {/* Indicador lateral */}
                    {isActive && (
                      <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                        style={{ background: 'var(--color-brand)', boxShadow: '0 0 8px var(--color-brand)' }} />
                    )}

                    <div className="relative z-10">
                      <p className="text-sm font-bold leading-none mb-0.5"
                        style={{ fontFamily: 'var(--font-display)', color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                        {month}
                      </p>
                      <p className="text-[10px] mb-2" style={{ color: 'var(--color-text-muted)' }}>{year}</p>
                      <p className="text-xs font-semibold" style={{ color: isActive ? 'var(--color-brand)' : 'var(--color-text-muted)', fontFamily: 'var(--font-display)' }}>
                        {fmt(t)}
                      </p>
                    </div>
                  </button>
                )
              })}
        </div>

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
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />

              {importRows.length === 0 ? (
                <button onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-3 py-12 rounded-xl border-2 border-dashed w-full transition-all"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.color = 'var(--color-brand)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--color-brand) 4%, transparent)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent' }}>
                  <Upload size={28} strokeWidth={1.5} />
                  <div className="text-center">
                    <p style={{ fontSize: '13px', fontWeight: 600 }}>Selecionar arquivo</p>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>.csv ou .txt</p>
                  </div>
                </button>
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
