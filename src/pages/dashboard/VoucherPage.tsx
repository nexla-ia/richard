import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cacheGet, cacheSet } from '@/lib/cache'
import {
  Ticket, Send, Users, Search, X, Loader2, Plus,
  CheckCircle2, AlertCircle, MessageSquare, User,
  Trash2, Pencil, FileText, Save, Upload, Download, FileSpreadsheet, CheckCheck,
} from 'lucide-react'
import * as XLSX from 'xlsx'

/* ─── Template CSV pra Vouchers ─── */
const CSV_TEMPLATE_VOUCHERS = `Codigo,Valor,Descricao\nPROMO50,50.00,50 reais de desconto\nBLACK2026,100.00,Black Friday 2026\nNATAL25,25.00,Natal 25 off`

function downloadVouchersTemplate() {
  const blob = new Blob(['﻿' + CSV_TEMPLATE_VOUCHERS], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'modelo_vouchers.csv'; a.click()
  URL.revokeObjectURL(url)
}

const WEBHOOK_URL = 'https://n8n.nexladesenvolvimento.com.br/webhook/0b4f66aa-9c8f-49e8-bb6b-91371f390ead'

type Status = 'pendente' | 'cobrado' | 'pago'
type Cliente = {
  id: number; nome: string; valor: number; telefone: string; dia_cobranca: number; status: Status
}
type Voucher  = { id: number; codigo: string; descricao: string | null; valor: number | null; created_at: string }
type Mensagem = { id: number; titulo: string; texto: string; created_at: string }

type Tab = 'vouchers' | 'mensagens' | 'enviar'
type Mode = 'individual' | 'massa'
type SendStatus = 'sending' | 'sent' | 'error'

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

async function dispararWebhook(payload: object): Promise<boolean> {
  try {
    const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    return res.ok
  } catch { return false }
}

function buildMsg(template: string, nome: string, voucher: string, valorVoucher: number | null) {
  return template
    .replace(/\{nome\}/g, nome)
    .replace(/\{voucher\}/g, voucher)
    .replace(/\{valor\}/g, valorVoucher != null ? fmt(valorVoucher) : 'R$ 0,00')
}

const MSG_PADRAO = 'Olá {nome}! Você ganhou um voucher exclusivo: *{voucher}*. Aproveite!'

export default function VoucherPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('vouchers')

  /* ── Estado: vouchers, mensagens, clientes ── */
  const [vouchers, setVouchers]   = useState<Voucher[]>(cacheGet<Voucher[]>('vouchers') ?? [])
  const [mensagens, setMensagens] = useState<Mensagem[]>(cacheGet<Mensagem[]>('voucher_mensagens') ?? [])
  const [clientes, setClientes]   = useState<Cliente[]>(cacheGet<Cliente[]>('clientes') ?? [])
  const [loading, setLoading]     = useState(true)

  /* ── Carregar tudo ── */
  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setLoading(false); return }
        const uid = session.user.id
        const sb = supabase as any
        const [v, m, c] = await Promise.all([
          sb.from('vouchers').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
          sb.from('voucher_mensagens').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
          sb.from('clientes').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        ])
        const vList = (v.data as Voucher[]) ?? []
        const mList = (m.data as Mensagem[]) ?? []
        const cList = (c.data as Cliente[]) ?? []
        cacheSet('vouchers', vList)
        cacheSet('voucher_mensagens', mList)
        cacheSet('clientes', cList)
        setVouchers(vList); setMensagens(mList); setClientes(cList)
      } catch (err) { console.error('[Voucher]', err) }
      setLoading(false)
    }
    load()
  }, [])

  /* ──────── RENDER ──────── */
  return (
    <div>
      <header className="flex items-end justify-between gap-6 flex-wrap mb-5 pb-4"
        style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-px" style={{ background: 'var(--color-brand)' }} />
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: 'var(--color-brand)' }}>
              Disparo de Voucher
            </p>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 2.6vw, 2.25rem)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>
            Voucher
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Cadastre vouchers, salve mensagens e dispare via WhatsApp.
          </p>
        </div>
      </header>

      {/* ─── Tabs ─── */}
      <div className="flex items-center gap-1 mb-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {[
          { id: 'vouchers',  label: 'Vouchers',  icon: Ticket,         count: vouchers.length },
          { id: 'mensagens', label: 'Mensagens', icon: MessageSquare,  count: mensagens.length },
          { id: 'enviar',    label: 'Enviar',    icon: Send,           count: null },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className="flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all relative"
              style={{
                color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
                background: 'transparent',
              }}>
              <Icon size={14} /> {t.label}
              {t.count !== null && t.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: active ? 'var(--color-brand)' : 'var(--color-surface-3)',
                    color: active ? 'white' : 'var(--color-text-muted)',
                  }}>
                  {t.count}
                </span>
              )}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.75 rounded-t-full"
                  style={{ background: 'var(--color-brand)' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* ─── Conteúdo da Tab ─── */}
      {tab === 'vouchers'  && <VouchersTab  list={vouchers}   setList={setVouchers}   loading={loading} />}
      {tab === 'mensagens' && <MensagensTab list={mensagens}  setList={setMensagens}  loading={loading} vouchers={vouchers} />}
      {tab === 'enviar'    && <EnviarTab    vouchers={vouchers} mensagens={mensagens} clientes={clientes} loading={loading} />}
    </div>
  )
}

/* ══════════════════════════════════════════
   TAB 1 — VOUCHERS (CRUD)
═══════════════════════════════════════════ */
function VouchersTab({ list, setList, loading }: { list: Voucher[]; setList: (l: Voucher[]) => void; loading: boolean }) {
  const supabase = createClient()
  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* Import */
  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState<{ codigo: string; valor: number | null; descricao: string }[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importDragOver, setImportDragOver] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  function processVoucherFile(file: File) {
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
        const skipHeader = isNaN(parseFloat(String(rowsArr[0][1] ?? '').replace(',', '.')))
        const dataRows = skipHeader ? rowsArr.slice(1) : rowsArr
        const parsed = dataRows.map((cols) => {
          const valorRaw = String(cols[1] ?? '').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
          const valorNum = parseFloat(valorRaw)
          return {
            codigo: String(cols[0] ?? '').trim().toUpperCase(),
            valor: isNaN(valorNum) || valorNum <= 0 ? null : valorNum,
            descricao: String(cols[2] ?? '').trim(),
          }
        }).filter((r) => r.codigo)
        if (parsed.length === 0) throw new Error('Nenhum voucher válido. Confira: Codigo, Valor, Descricao')
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
    if (f) processVoucherFile(f)
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
        codigo: r.codigo,
        valor: r.valor,
        descricao: r.descricao || null,
      }))
      const { data } = await (supabase as any).from('vouchers').insert(toInsert).select()
      if (data) {
        const updated = [...(data as Voucher[]), ...list]
        setList(updated); cacheSet('vouchers', updated)
      }
      setImportDone(true)
      setTimeout(() => {
        setShowImport(false); setImportRows([]); setImportDone(false)
      }, 1500)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Erro ao importar')
    }
    setImportLoading(false)
  }

  async function add() {
    const c = codigo.trim().toUpperCase()
    if (!c) { setError('Digite o código do voucher'); return }
    const valorNum = parseFloat(valor.replace(',', '.').replace(/[^\d.]/g, ''))
    setError(null); setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada')
      const { data, error } = await (supabase as any).from('vouchers').insert({
        user_id: user.id,
        codigo: c,
        descricao: descricao.trim() || null,
        valor: isNaN(valorNum) || valorNum <= 0 ? null : valorNum,
      }).select().single()
      if (error) throw error
      if (data) {
        const updated = [data as Voucher, ...list]
        setList(updated)
        cacheSet('vouchers', updated)
      }
      setCodigo(''); setDescricao(''); setValor('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    }
    setSaving(false)
  }

  async function remove(v: Voucher) {
    if (!confirm(`Excluir voucher ${v.codigo}?`)) return
    const updated = list.filter((x) => x.id !== v.id)
    setList(updated); cacheSet('vouchers', updated)
    await (supabase as any).from('vouchers').delete().eq('id', v.id)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Form cadastro */}
      <section className="rounded-2xl p-5"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <Plus size={14} style={{ color: 'var(--color-brand)' }} />
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>Cadastrar novo voucher</p>
          </div>
          <button
            onClick={() => { setShowImport(true); setImportRows([]); setImportError(null); setImportDone(false) }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-brand)'; e.currentTarget.style.borderColor = 'var(--color-brand)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.borderColor = 'var(--color-border)' }}>
            <FileSpreadsheet size={12} /> Importar planilha
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
          O <strong style={{ color: 'var(--color-text)' }}>código</strong> é o que vai na mensagem. O <strong style={{ color: 'var(--color-text)' }}>valor</strong> é o desconto/crédito do voucher.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_2fr_auto] gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Código *</p>
            <div className="relative">
              <Ticket size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-brand)' }} />
              <input
                type="text" value={codigo} placeholder="PROMO50"
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') add() }}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.03em' }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-brand) 12%, transparent)' }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
              Valor (R$) <span style={{ fontWeight: 400 }}>opcional</span>
            </p>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--color-brand)' }}>R$</span>
              <input
                type="text" value={valor} placeholder="50,00"
                onChange={(e) => setValor(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') add() }}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-display)', fontWeight: 700 }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-brand) 12%, transparent)' }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
              Descrição <span style={{ fontWeight: 400 }}>opcional</span>
            </p>
            <input
              type="text" value={descricao} placeholder="Ex.: Black Friday 2026, 50% off..."
              onChange={(e) => setDescricao(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add() }}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)' }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)' }}
            />
          </div>
          <div className="flex items-end">
            <button onClick={add} disabled={saving || !codigo.trim()}
              className="h-10.5 flex items-center gap-2 px-5 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
              style={codigo.trim() && !saving
                ? { background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }
                : { background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', cursor: 'not-allowed' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Cadastrar
            </button>
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs"
            style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626' }}>
            <AlertCircle size={12} /> {error}
          </div>
        )}
      </section>

      {/* Lista */}
      <section className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
        <div className="px-5 py-3.5 flex items-center justify-between"
          style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem' }}>Vouchers cadastrados</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {list.length} {list.length === 1 ? 'voucher' : 'vouchers'}
          </p>
        </div>

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="skeleton w-8 h-8 rounded-lg" />
              <span className="skeleton h-4 w-24" />
              <span className="skeleton h-3 w-48 ml-2" />
            </div>
          ))
        ) : list.length === 0 ? (
          <div className="px-5 py-14 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--color-brand) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-brand) 20%, transparent)' }}>
              <Ticket size={20} style={{ color: 'var(--color-brand)' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Nenhum voucher ainda</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Cadastre seu primeiro voucher acima — ele fica salvo no banco pra reuso.
              </p>
            </div>
          </div>
        ) : (
          list.map((v, i) => (
            <div key={v.id}
              className="flex items-center gap-4 px-5 py-3.5 transition-colors group animate-fade-in"
              style={{
                borderBottom: i < list.length - 1 ? '1px solid var(--color-border)' : 'none',
                animationDelay: `${Math.min(i * 25, 200)}ms`,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>

              {/* Ticket stub */}
              <div className="flex items-stretch shrink-0">
                <div className="flex items-center justify-center px-3 rounded-l-xl"
                  style={{ background: 'var(--color-brand)', borderRight: '1.5px dashed color-mix(in srgb, white 50%, var(--color-brand))' }}>
                  <Ticket size={13} className="text-white" />
                </div>
                <div className="pl-3 pr-3 py-2 rounded-r-xl"
                  style={{ background: 'color-mix(in srgb, var(--color-brand) 8%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-brand) 30%, transparent)', borderLeft: 'none' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-brand)', letterSpacing: '0.04em' }}>
                    {v.codigo}
                  </span>
                </div>
              </div>

              {/* Descrição */}
              <div className="flex-1 min-w-0">
                {v.descricao
                  ? <p className="text-sm truncate" style={{ color: 'var(--color-text)' }}>{v.descricao}</p>
                  : <p className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>Sem descrição</p>}
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Cadastrado em {new Date(v.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>

              {/* Valor */}
              {v.valor != null && v.valor > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>Valor</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-brand)', lineHeight: 1, letterSpacing: '-0.01em' }}>
                    {fmt(v.valor)}
                  </p>
                </div>
              )}

              <button onClick={() => remove(v)} title="Excluir"
                className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                style={{ color: '#dc2626' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220,38,38,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </section>

      {/* ── Modal Importar Vouchers ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowImport(false)}>
          <div className="w-full max-w-xl rounded-2xl overflow-hidden animate-fade-in"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between"
              style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, var(--color-brand) 12%, transparent)' }}>
                  <FileSpreadsheet size={17} style={{ color: 'var(--color-brand)' }} />
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text)' }}>
                    Importar lista de vouchers
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Cadastre vários vouchers de uma vez através de uma planilha
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
              {/* PASSO 1: Baixar modelo */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: 'color-mix(in srgb, var(--color-brand) 7%, transparent)', border: '1px dashed color-mix(in srgb, var(--color-brand) 35%, transparent)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{ background: 'var(--color-brand)', color: 'white' }}>1</span>
                  <div className="min-w-0">
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>Baixe o modelo CSV</p>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 1 }}>Abra no Excel ou Google Planilhas e preencha</p>
                  </div>
                </div>
                <button onClick={downloadVouchersTemplate}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95 shrink-0"
                  style={{ background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }}>
                  <Download size={13} /> Baixar
                </button>
              </div>

              {/* PASSO 2: Formato */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>2</span>
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>Preencha estas 3 colunas</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['Codigo', 'Valor', 'Descricao'].map((c, i) => (
                      <span key={c} className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                        style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>{String.fromCharCode(65 + i)}</span> · {c}
                      </span>
                    ))}
                  </div>
                  <p className="font-mono mt-2" style={{ fontSize: '11px', color: 'var(--color-brand)' }}>
                    PROMO50,50.00,50 reais de desconto
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
                      const f = e.dataTransfer.files?.[0]; if (f) processVoucherFile(f)
                    }}
                    className="flex flex-col items-center gap-3 py-10 rounded-xl border-2 border-dashed w-full transition-all cursor-pointer"
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
                        {importRows.length} voucher{importRows.length !== 1 ? 's' : ''} pronto{importRows.length !== 1 ? 's' : ''} pra importar
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
                          {['Código', 'Valor', 'Descrição'].map((h, i) => (
                            <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider"
                              style={{ color: 'var(--color-text-muted)', fontSize: '10px', width: i === 0 ? '140px' : i === 1 ? '100px' : 'auto' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((r, i) => (
                          <tr key={i} style={{ borderBottom: i < importRows.length - 1 ? '1px solid var(--color-border)' : 'none', background: i % 2 === 0 ? 'var(--color-surface-2)' : 'var(--color-surface)' }}>
                            <td className="px-3 py-2 font-bold" style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-display)', letterSpacing: '0.03em' }}>{r.codigo}</td>
                            <td className="px-3 py-2 font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
                              {r.valor != null ? fmt(r.valor) : '—'}
                            </td>
                            <td className="px-3 py-2 truncate" style={{ color: 'var(--color-text-muted)' }}>{r.descricao || '—'}</td>
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
                     : <><Upload size={15} /> Importar {importRows.length} voucher{importRows.length !== 1 ? 's' : ''}</>}
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

/* ══════════════════════════════════════════
   TAB 2 — MENSAGENS (CRUD templates)
═══════════════════════════════════════════ */
function MensagensTab({ list, setList, loading, vouchers }: { list: Mensagem[]; setList: (l: Mensagem[]) => void; loading: boolean; vouchers: Voucher[] }) {
  const supabase = createClient()
  const [modal, setModal] = useState<{ mode: 'new' | 'edit'; data: Partial<Mensagem> } | null>(null)
  const [saving, setSaving] = useState(false)

  async function saveMensagem() {
    if (!modal) return
    const { titulo, texto } = modal.data
    if (!titulo?.trim() || !texto?.trim()) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada')
      if (modal.mode === 'new') {
        const { data, error } = await (supabase as any).from('voucher_mensagens').insert({
          user_id: user.id, titulo: titulo.trim(), texto: texto.trim(),
        }).select().single()
        if (error) throw error
        if (data) { const u = [data as Mensagem, ...list]; setList(u); cacheSet('voucher_mensagens', u) }
      } else {
        await (supabase as any).from('voucher_mensagens').update({ titulo: titulo.trim(), texto: texto.trim() }).eq('id', modal.data.id)
        const u = list.map((m) => m.id === modal.data.id ? { ...m, titulo: titulo.trim(), texto: texto.trim() } : m)
        setList(u); cacheSet('voucher_mensagens', u)
      }
      setModal(null)
    } catch (err) { console.error(err) }
    setSaving(false)
  }

  async function remove(m: Mensagem) {
    if (!confirm(`Excluir mensagem "${m.titulo}"?`)) return
    const u = list.filter((x) => x.id !== m.id); setList(u); cacheSet('voucher_mensagens', u)
    await (supabase as any).from('voucher_mensagens').delete().eq('id', m.id)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header com botão nova */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Crie templates de mensagem com variáveis <code style={{ background: 'var(--color-surface-3)', padding: '1px 5px', borderRadius: 4 }}>{'{nome}'}</code>, <code style={{ background: 'var(--color-surface-3)', padding: '1px 5px', borderRadius: 4 }}>{'{voucher}'}</code>, <code style={{ background: 'var(--color-surface-3)', padding: '1px 5px', borderRadius: 4 }}>{'{valor}'}</code>.
        </p>
        <button onClick={() => setModal({ mode: 'new', data: { texto: MSG_PADRAO } })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97] shrink-0"
          style={{ background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }}>
          <Plus size={14} /> Nova mensagem
        </button>
      </div>

      {/* Lista cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-5" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
              <span className="skeleton h-4 w-32 block mb-3" />
              <span className="skeleton h-3 w-full block mb-1.5" />
              <span className="skeleton h-3 w-3/4 block" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl py-14 px-5 text-center flex flex-col items-center gap-3"
          style={{ background: 'var(--color-surface-2)', border: '1px dashed var(--color-border)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--color-brand) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-brand) 20%, transparent)' }}>
            <FileText size={20} style={{ color: 'var(--color-brand)' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Nenhuma mensagem salva</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Crie templates pra reutilizar nos disparos.</p>
          </div>
          <button onClick={() => setModal({ mode: 'new', data: { texto: MSG_PADRAO } })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold mt-1"
            style={{ background: 'var(--color-brand)', color: 'white' }}>
            <Plus size={13} /> Criar primeira mensagem
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map((m, i) => (
            <div key={m.id}
              className="rounded-2xl p-5 transition-all hover:-translate-y-0.5 group animate-fade-in"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
                animationDelay: `${Math.min(i * 30, 200)}ms`,
              }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', letterSpacing: '-0.01em' }} className="truncate">
                    {m.titulo}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setModal({ mode: 'edit', data: m })}
                    className="p-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-3)'; e.currentTarget.style.color = 'var(--color-brand)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)' }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => remove(m)}
                    className="p-1.5 rounded-lg" style={{ color: '#dc2626' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220,38,38,0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="text-xs leading-relaxed line-clamp-4" style={{ color: 'var(--color-text-muted)' }}>
                {m.texto}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && <MensagemModal modal={modal} setModal={setModal} saving={saving} onSave={saveMensagem} vouchers={vouchers} />}
    </div>
  )
}

/* ══════════════════════════════════════════
   MODAL DE MENSAGEM — split editor + preview
═══════════════════════════════════════════ */
const TEMPLATES = [
  {
    nome: 'Voucher promocional',
    titulo: 'Promo Voucher',
    texto: 'Olá {nome}! 🎉\n\nVocê ganhou um voucher exclusivo:\n\n*{voucher}*\n\nUse no próximo agendamento. Aproveite!',
  },
  {
    nome: 'Black Friday',
    titulo: 'Black Friday VIP',
    texto: 'Oi {nome}! ✨\n\nLiberamos um voucher *VIP* da Black Friday só pra você:\n\n👉 *{voucher}*\n\nVálido até o fim do mês. Não perca!',
  },
  {
    nome: 'Aniversário',
    titulo: 'Aniversário',
    texto: 'Feliz aniversário, {nome}! 🎂\n\nDe presente, um voucher especial:\n\n*{voucher}*\n\nQue seu dia seja incrível!',
  },
]

function MensagemModal({ modal, setModal, saving, onSave, vouchers }: {
  modal: { mode: 'new' | 'edit'; data: Partial<Mensagem> }
  setModal: (m: { mode: 'new' | 'edit'; data: Partial<Mensagem> } | null) => void
  saving: boolean
  onSave: () => void
  vouchers: Voucher[]
}) {
  type Step = 1 | 2
  const [step, setStep] = useState<Step>(modal.mode === 'edit' ? 2 : 1)

  const texto = modal.data.texto ?? ''
  const titulo = modal.data.titulo ?? ''

  /* Voucher exemplo para visualização — primeiro cadastrado ou fallback */
  const previewVoucherId = vouchers[0]?.id ?? null
  const exVoucher = vouchers.find((v) => v.id === previewVoucherId) ?? vouchers[0]
  const exCodigo = exVoucher?.codigo ?? 'PROMO50'
  const exValor  = exVoucher?.valor != null && exVoucher.valor > 0 ? fmt(exVoucher.valor) : 'R$ 50,00'

  /* Preview vivo — usa valor do voucher exemplo */
  const preview = texto
    .replace(/\{nome\}/g, 'Maria Silva')
    .replace(/\{voucher\}/g, exCodigo)
    .replace(/\{valor\}/g, exValor) || '_(comece a digitar a mensagem ao lado para ver o preview)_'

  function insertVar(v: string) {
    setModal({ ...modal, data: { ...modal.data, texto: (texto + ' ' + v).trim() } })
  }
  function loadTemplate(t: typeof TEMPLATES[0]) {
    setModal({ ...modal, data: { ...modal.data, titulo: titulo || t.titulo, texto: t.texto } })
  }

  const canNext1 = titulo.trim().length > 0
  const canSave  = titulo.trim().length > 0 && texto.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
      onClick={() => setModal(null)}>
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden animate-fade-in"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', boxShadow: '0 32px 80px -8px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between relative overflow-hidden"
          style={{ borderBottom: '1px solid var(--color-border)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-brand) 8%, var(--color-surface-3)), var(--color-surface-3))' }}>
          {/* glow */}
          <div className="absolute -top-12 right-20 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: 'var(--color-brand)', filter: 'blur(60px)', opacity: 0.1 }} />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--color-brand)', boxShadow: '0 6px 16px -6px color-mix(in srgb, var(--color-brand) 60%, transparent)' }}>
              <MessageSquare size={17} className="text-white" />
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem', color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
                {modal.mode === 'new' ? 'Nova mensagem' : 'Editar mensagem'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Passo {step} de 2
              </p>
            </div>
          </div>
          <button onClick={() => setModal(null)} className="relative p-1.5 rounded-lg transition-all"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <X size={17} />
          </button>
        </div>

        {/* ─── STEPPER ─── */}
        <div className="px-6 py-3 flex items-center" style={{ background: 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
          {[{ n: 1, label: 'Nome' }, { n: 2, label: 'Mensagem' }].map((s, i) => {
            const isActive = step === s.n
            const isDone = step > s.n
            return (
              <div key={s.n} className="flex items-center flex-1">
                <button
                  onClick={() => {
                    if (s.n === 1 || (s.n === 2 && canNext1)) setStep(s.n as 1 | 2)
                  }}
                  className="flex items-center gap-2 transition-all">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                    style={isActive
                      ? { background: 'var(--color-brand)', color: 'white', fontFamily: 'var(--font-display)', boxShadow: '0 4px 12px -4px color-mix(in srgb, var(--color-brand) 60%, transparent)' }
                      : isDone
                      ? { background: 'color-mix(in srgb, var(--color-brand) 15%, transparent)', color: 'var(--color-brand)', border: '1.5px solid var(--color-brand)', fontFamily: 'var(--font-display)' }
                      : { background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', fontFamily: 'var(--font-display)' }}>
                    {isDone ? <CheckCircle2 size={12} /> : s.n}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider hidden sm:inline"
                    style={{ color: isActive || isDone ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                    {s.label}
                  </span>
                </button>
                {i < 1 && (
                  <div className="flex-1 h-0.5 mx-3 rounded-full transition-all"
                    style={{ background: isDone ? 'var(--color-brand)' : 'var(--color-border)' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Body 2 colunas */}
        {/* ─── PASSO 1: Nome ─── */}
        {step === 1 && (
          <div className="animate-fade-in flex flex-col gap-5 max-w-lg mx-auto p-6 w-full">
            <div className="text-center mb-1">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'color-mix(in srgb, var(--color-brand) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-brand) 25%, transparent)' }}>
                <Pencil size={22} style={{ color: 'var(--color-brand)' }} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                Como vai chamar essa mensagem?
              </h2>
              <p className="text-sm mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Só você vê — serve pra encontrar a mensagem depois.
              </p>
            </div>
            <input
              autoFocus type="text"
              placeholder="Ex.: Black Friday VIP, Promo Natal..."
              value={titulo}
              onChange={(e) => setModal({ ...modal, data: { ...modal.data, titulo: e.target.value } })}
              onKeyDown={(e) => { if (e.key === 'Enter' && canNext1) setStep(2) }}
              className="w-full px-5 py-4 rounded-xl outline-none transition-all text-center"
              style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)'; e.target.style.boxShadow = '0 0 0 4px color-mix(in srgb, var(--color-brand) 12%, transparent)' }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
            />
            {modal.mode === 'new' && !texto && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  ou comece com um modelo
                </p>
                <div className="flex flex-col gap-2">
                  {TEMPLATES.map((t) => (
                    <button key={t.nome} onClick={() => loadTemplate(t)}
                      className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-left transition-all hover:-translate-y-0.5"
                      style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--color-brand) 4%, transparent)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-surface)' }}>
                      <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>{t.nome}</p>
                        <p className="text-[11px] line-clamp-1 mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{t.texto.split('\n')[0]}</p>
                      </div>
                      <span className="text-[11px] font-bold shrink-0" style={{ color: 'var(--color-brand)' }}>usar →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── PASSO 2: Mensagem (editor + preview) ─── */}
        {step === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 animate-fade-in">

          {/* ─── ESQUERDA: editor ─── */}
          <div className="p-6 flex flex-col gap-5" style={{ borderRight: '1px solid var(--color-border)' }}>

            {/* Texto */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Texto da mensagem *
              </label>
              <textarea rows={7}
                value={texto}
                onChange={(e) => setModal({ ...modal, data: { ...modal.data, texto: e.target.value } })}
                placeholder="Escreva aqui a mensagem que será enviada via WhatsApp..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none leading-relaxed transition-all"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-brand) 10%, transparent)' }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }} />
              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{texto.length} caracteres</span>
              </div>
            </div>

            {/* Variáveis explicadas */}
            <div className="rounded-xl p-3"
              style={{ background: 'color-mix(in srgb, var(--color-brand) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--color-brand) 20%, transparent)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2.5" style={{ color: 'var(--color-brand)' }}>
                💡 Variáveis — substituídas automaticamente
              </p>
              <div className="flex flex-col gap-1.5">
                {[
                  { v: '{nome}',    desc: 'Nome do cliente',             exemplo: 'Maria Silva' },
                  { v: '{voucher}', desc: 'Código do voucher escolhido', exemplo: exCodigo },
                  { v: '{valor}',   desc: 'Valor do voucher escolhido',  exemplo: exValor },
                ].map(({ v, desc, exemplo }) => (
                  <button key={v} onClick={() => insertVar(v)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-all group"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-brand)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}>
                    <code className="font-mono font-bold" style={{ color: 'var(--color-brand)', minWidth: 70 }}>{v}</code>
                    <span style={{ color: 'var(--color-text-muted)' }}>→ {desc}</span>
                    <span className="ml-auto px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)' }}>
                      ex: {exemplo}
                    </span>
                    <Plus size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-brand)' }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── DIREITA: preview WhatsApp ─── */}
          <div className="flex flex-col" style={{ background: 'var(--color-surface)' }}>
            {/* Sub-header */}
            <div className="px-6 py-3 flex items-center justify-between gap-2"
              style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-3)' }}>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#16a34a', boxShadow: '0 0 6px #16a34a' }} />
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
                  Prévia ao vivo
                </p>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: 'color-mix(in srgb, var(--color-brand) 12%, transparent)', color: 'var(--color-brand)', border: '1px solid color-mix(in srgb, var(--color-brand) 25%, transparent)' }}>
                Exemplo · {exCodigo}
              </span>
            </div>

            {/* WhatsApp mockup */}
            <div className="flex-1 flex flex-col p-5 relative"
              style={{
                background: '#e5ded7',
                backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4) 0, transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.3) 0, transparent 50%)',
                minHeight: 420,
              }}>
              {/* Cabeçalho chat */}
              <div className="flex items-center gap-2.5 mb-4 pb-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                  style={{ background: '#075e54', color: 'white' }}>SC</div>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#111' }}>Studio Charme</p>
                  <p className="text-[10px]" style={{ color: '#667781' }}>online</p>
                </div>
              </div>

              {/* Bubble */}
              <div className="max-w-[92%]">
                <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 relative"
                  style={{ background: '#dcf8c6', boxShadow: '0 1px 1px rgba(0,0,0,0.08)' }}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#111', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {preview.split(/(\*[^*]+\*)/).map((part, i) =>
                      part.startsWith('*') && part.endsWith('*')
                        ? <strong key={i}>{part.slice(1, -1)}</strong>
                        : <span key={i}>{part}</span>
                    )}
                  </p>
                  <p className="text-[10px] text-right mt-1" style={{ color: '#667781' }}>
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </p>
                </div>
              </div>

              {/* Dica formatação */}
              <div className="mt-auto pt-4">
                <div className="rounded-xl px-3 py-2 text-[10px] leading-relaxed"
                  style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)', color: '#555' }}>
                  <strong style={{ color: '#075e54' }}>Formatação WhatsApp:</strong> use <code style={{ background: '#f5f5f5', padding: '0 4px', borderRadius: 3 }}>*negrito*</code>, <code style={{ background: '#f5f5f5', padding: '0 4px', borderRadius: 3 }}>_itálico_</code>, <code style={{ background: '#f5f5f5', padding: '0 4px', borderRadius: 3 }}>~riscado~</code>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ─── FOOTER NAV ─── */}
        <div className="px-6 py-3 flex items-center justify-between"
          style={{ background: 'var(--color-surface-3)', borderTop: '1px solid var(--color-border)' }}>
          {step > 1 ? (
            <button onClick={() => setStep((step - 1) as 1 | 2)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ color: 'var(--color-text-muted)', background: 'transparent' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              ← Voltar
            </button>
          ) : (
            <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ color: 'var(--color-text-muted)' }}>
              Cancelar
            </button>
          )}

          {step < 2 ? (
            <button onClick={() => setStep(2)}
              disabled={!canNext1}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
              style={canNext1
                ? { background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }
                : { background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', cursor: 'not-allowed' }}>
              Avançar →
            </button>
          ) : (
            <button onClick={onSave} disabled={saving || !canSave}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
              style={canSave && !saving
                ? { background: 'var(--color-brand)', color: 'white', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)' }
                : { background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', cursor: 'not-allowed' }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {modal.mode === 'new' ? 'Salvar mensagem' : 'Atualizar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   TAB 3 — ENVIAR (puxa voucher + mensagem + clientes)
═══════════════════════════════════════════ */
function EnviarTab({ vouchers, mensagens, clientes, loading }: {
  vouchers: Voucher[]; mensagens: Mensagem[]; clientes: Cliente[]; loading: boolean
}) {
  const [voucherId, setVoucherId]   = useState<number | null>(vouchers[0]?.id ?? null)
  const [mensagemId, setMensagemId] = useState<number | null>(mensagens[0]?.id ?? null)
  const [mode, setMode]             = useState<Mode>('massa')
  const [search, setSearch]         = useState('')
  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set())
  const [individualId, setIndividualId] = useState<number | null>(null)
  const [sending, setSending]       = useState(false)
  const [progress, setProgress]     = useState<Record<number, SendStatus>>({})
  const [summary, setSummary]       = useState<{ ok: number; fail: number } | null>(null)
  const cancelRef = useRef(false)

  useEffect(() => { if (!voucherId && vouchers[0]) setVoucherId(vouchers[0].id) }, [vouchers])
  useEffect(() => { if (!mensagemId && mensagens[0]) setMensagemId(mensagens[0].id) }, [mensagens])

  const voucher  = vouchers.find((v) => v.id === voucherId) ?? null
  const mensagem = mensagens.find((m) => m.id === mensagemId) ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter((c) => c.nome.toLowerCase().includes(q) || c.telefone.toLowerCase().includes(q))
  }, [clientes, search])

  const alvos: Cliente[] = useMemo(() => {
    if (mode === 'individual') { const c = clientes.find((x) => x.id === individualId); return c ? [c] : [] }
    return clientes.filter((c) => selectedIds.has(c.id))
  }, [mode, clientes, individualId, selectedIds])

  const canSend = !!voucher && !!mensagem && alvos.length > 0 && !sending

  async function dispararEnvios() {
    if (!canSend || !voucher || !mensagem) return
    setSending(true); setSummary(null); setProgress({}); cancelRef.current = false
    let ok = 0, fail = 0
    for (const c of alvos) {
      if (cancelRef.current) break
      setProgress((p) => ({ ...p, [c.id]: 'sending' }))
      const success = await dispararWebhook({
        voucher: voucher.codigo,
        voucher_valor: voucher.valor,
        nome: c.nome, telefone: c.telefone, valor: c.valor, dia_cobranca: c.dia_cobranca,
        mensagem: buildMsg(mensagem.texto, c.nome, voucher.codigo, voucher.valor),
      })
      if (success) ok++; else fail++
      setProgress((p) => ({ ...p, [c.id]: success ? 'sent' : 'error' }))
    }
    setSummary({ ok, fail }); setSending(false)
  }

  function reset() { setSummary(null); setProgress({}); setSelectedIds(new Set()); setIndividualId(null) }

  /* Bloqueio caso falta voucher ou mensagem */
  if (!loading && (vouchers.length === 0 || mensagens.length === 0)) {
    return (
      <div className="rounded-2xl p-10 text-center"
        style={{ background: 'var(--color-surface-2)', border: '1px dashed var(--color-border)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'color-mix(in srgb, #f59e0b 10%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)' }}>
          <AlertCircle size={22} style={{ color: '#f59e0b' }} />
        </div>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>
          Falta cadastrar {vouchers.length === 0 && 'voucher'}{vouchers.length === 0 && mensagens.length === 0 && ' e '}{mensagens.length === 0 && 'mensagem'}
        </p>
        <p className="text-sm mt-2 mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Vá nas abas <strong style={{ color: 'var(--color-brand)' }}>Vouchers</strong> e <strong style={{ color: 'var(--color-brand)' }}>Mensagens</strong> antes de enviar.
        </p>
      </div>
    )
  }


  return (
    <div>
      {/* ══ Pós-envio Banner ══ */}
      {summary && (
        <div className="mb-5 rounded-2xl p-5 animate-fade-in flex items-center gap-4"
          style={{ background: 'var(--color-surface-2)', border: `1px solid ${summary.fail === 0 ? '#16a34a' : '#f59e0b'}`, boxShadow: `0 8px 24px -12px ${summary.fail === 0 ? '#16a34a' : '#f59e0b'}` }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: summary.fail === 0 ? 'rgba(22,163,74,0.12)' : 'rgba(245,158,11,0.12)' }}>
            {summary.fail === 0 ? <CheckCircle2 size={22} style={{ color: '#16a34a' }} /> : <AlertCircle size={22} style={{ color: '#f59e0b' }} />}
          </div>
          <div className="flex-1">
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem' }}>
              {summary.fail === 0 ? 'Tudo enviado!' : 'Envio concluído'}
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              <strong style={{ color: '#16a34a' }}>{summary.ok}</strong> enviado{summary.ok !== 1 ? 's' : ''}
              {summary.fail > 0 && <> · <strong style={{ color: '#dc2626' }}>{summary.fail}</strong> falhou{summary.fail !== 1 ? 'ram' : ''}</>}
            </p>
          </div>
          <button onClick={reset} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: 'var(--color-brand)', color: 'white' }}>
            Novo disparo
          </button>
        </div>
      )}

      {/* ══ Grid principal: 3 sections | launchpad ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">

        {/* ─── ESQUERDA: 3 cards ─── */}
        <div className="flex flex-col gap-4">

          {/* CARD 1 — VOUCHER */}
          <SectionCard
            number={1}
            title="Voucher"
            subtitle="Qual código vai ser enviado pelo WhatsApp"
            done={!!voucher}
            icon={<Ticket size={16} className="text-white" />}>
            <VoucherPicker vouchers={vouchers} voucherId={voucherId} setVoucherId={setVoucherId} hideHeader />
          </SectionCard>

          {/* CARD 2 — MENSAGEM */}
          <SectionCard
            number={2}
            title="Mensagem"
            subtitle="Modelo de texto que acompanha o voucher"
            done={!!mensagem}
            icon={<MessageSquare size={16} className="text-white" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto">
              {mensagens.map((m) => {
                const isActive = mensagemId === m.id
                return (
                  <button key={m.id} onClick={() => setMensagemId(m.id)}
                    className="text-left p-3 rounded-xl transition-all active:scale-[0.98] hover:-translate-y-0.5 relative"
                    style={isActive
                      ? { background: 'color-mix(in srgb, var(--color-brand) 5%, var(--color-surface))', border: '1.5px solid var(--color-brand)', boxShadow: '0 4px 14px -4px color-mix(in srgb, var(--color-brand) 40%, transparent)' }
                      : { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}>
                    {isActive && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--color-brand)' }}>
                        <CheckCircle2 size={11} className="text-white" />
                      </span>
                    )}
                    <p className="text-sm font-bold truncate pr-6" style={{ fontFamily: 'var(--font-display)', color: isActive ? 'var(--color-brand)' : 'var(--color-text)', letterSpacing: '-0.01em' }}>
                      {m.titulo}
                    </p>
                    <p className="text-[11px] mt-1 line-clamp-2 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                      {m.texto}
                    </p>
                  </button>
                )
              })}
            </div>
          </SectionCard>

          {/* CARD 3 — CLIENTES */}
          <SectionCard
            number={3}
            title="Destinatários"
            subtitle="Pra quem mandar a mensagem"
            done={alvos.length > 0}
            icon={<Users size={16} className="text-white" />}>

            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="inline-flex rounded-xl p-1 gap-1" style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                {([['massa', Users, 'Em massa'], ['individual', User, 'Individual']] as const).map(([m, Icon, label]) => (
                  <button key={m} onClick={() => { setMode(m); setSelectedIds(new Set()); setIndividualId(null) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={mode === m
                      ? { background: 'var(--color-surface-2)', color: 'var(--color-brand)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
                      : { color: 'var(--color-text-muted)' }}>
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-32">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
                <input type="text" placeholder="Buscar cliente…" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
              </div>
              {mode === 'massa' && (
                <>
                  <button onClick={() => setSelectedIds(new Set(filtered.map((c) => c.id)))}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                    style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                    Todos
                  </button>
                  {selectedIds.size > 0 && (
                    <button onClick={() => setSelectedIds(new Set())}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                      style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                      Limpar ({selectedIds.size})
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Grid de clientes */}
            {clientes.length === 0 ? (
              <div className="px-5 py-10 text-center rounded-xl" style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}>
                <Users size={22} className="mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Nenhum cliente</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Cadastre na aba "Clientes" primeiro.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                {filtered.map((c) => {
                  const isSelected = mode === 'individual' ? individualId === c.id : selectedIds.has(c.id)
                  const send = progress[c.id]
                  return (
                    <button key={c.id} disabled={sending}
                      onClick={() => mode === 'individual' ? setIndividualId(c.id) : setSelectedIds((p) => { const n = new Set(p); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all active:scale-[0.98] relative"
                      style={isSelected
                        ? { background: 'color-mix(in srgb, var(--color-brand) 5%, var(--color-surface))', border: '1.5px solid var(--color-brand)' }
                        : { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}>
                      <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: isSelected ? 'var(--color-brand)' : 'var(--color-surface-3)', border: `1.5px solid ${isSelected ? 'var(--color-brand)' : 'var(--color-border)'}` }}>
                        {isSelected && <CheckCircle2 size={10} className="text-white" />}
                      </span>
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--color-brand) 10%, transparent)', color: 'var(--color-brand)' }}>
                        {(c.nome || '?').trim().split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{c.nome}</p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>{c.telefone || 'sem telefone'}</p>
                      </div>
                      {send === 'sending' && <Loader2 size={12} className="animate-spin shrink-0" style={{ color: 'var(--color-brand)' }} />}
                      {send === 'sent'    && <CheckCircle2 size={12} className="shrink-0" style={{ color: '#16a34a' }} />}
                      {send === 'error'   && <AlertCircle size={12} className="shrink-0" style={{ color: '#dc2626' }} />}
                    </button>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ─── DIREITA: Launchpad ─── */}
        <aside className="lg:sticky lg:top-4 flex flex-col gap-4">

          {/* LAUNCHPAD HERO */}
          <div className="rounded-2xl overflow-hidden"
            style={{
              background: canSend
                ? 'linear-gradient(135deg, var(--color-brand), color-mix(in srgb, var(--color-brand) 70%, #4f46e5))'
                : 'var(--color-surface-2)',
              border: canSend ? 'none' : '1px solid var(--color-border)',
              boxShadow: canSend
                ? '0 16px 48px -12px color-mix(in srgb, var(--color-brand) 50%, transparent)'
                : '0 1px 0 rgba(0,0,0,0.02)',
              transition: 'all 0.3s ease',
            }}>

            {/* Topo: badge status */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase"
                style={{ color: canSend ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)' }}>
                {canSend ? '✓ Pronto pra enviar' : 'Configurando…'}
              </p>
              {canSend && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}>
                  Disparo sequencial
                </span>
              )}
            </div>

            {/* Big number */}
            <div className="px-5 pb-5 flex items-baseline gap-2">
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '3.5rem',
                fontWeight: 800,
                lineHeight: 1,
                color: canSend ? 'white' : 'var(--color-text-muted)',
                letterSpacing: '-0.04em',
              }}>
                {alvos.length}
              </span>
              <span style={{ color: canSend ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)', fontSize: 13 }}>
                {alvos.length === 1 ? 'mensagem' : 'mensagens'}
              </span>
            </div>

            {/* Resumo do que vai */}
            <div className="px-5 pb-4 space-y-2.5">
              <ResumoLinha
                label="Voucher"
                value={voucher?.codigo ?? null}
                hint={voucher?.valor != null && voucher.valor > 0 ? fmt(voucher.valor) : undefined}
                light={canSend}
              />
              <ResumoLinha label="Texto" value={mensagem?.titulo ?? null} light={canSend} />
              <ResumoLinha label="Destinatários" value={alvos.length > 0 ? `${alvos.length} ${alvos.length === 1 ? 'pessoa' : 'pessoas'}` : null} light={canSend} />
            </div>

            {/* Botão disparar */}
            <div className="p-4" style={{ background: canSend ? 'rgba(0,0,0,0.08)' : 'var(--color-surface-3)', borderTop: canSend ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--color-border)' }}>
              {!sending && (
                <button onClick={dispararEnvios} disabled={!canSend}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
                  style={canSend
                    ? { background: 'white', color: 'var(--color-brand)', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }
                    : { background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', cursor: 'not-allowed' }}>
                  <Send size={15} />
                  {canSend ? `Disparar agora` : 'Disparar'}
                </button>
              )}

              {sending && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'white' }}>
                    <span>Enviando…</span>
                    <span style={{ fontFamily: 'var(--font-display)' }}>
                      {Object.values(progress).filter((s) => s === 'sent' || s === 'error').length} / {alvos.length}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <div className="h-full transition-all rounded-full"
                      style={{
                        width: `${(Object.values(progress).filter((s) => s === 'sent' || s === 'error').length / alvos.length) * 100}%`,
                        background: 'white',
                      }} />
                  </div>
                  <button onClick={() => { cancelRef.current = true }}
                    className="w-full py-2 rounded-lg text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}>
                    Cancelar envio
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Avisos do que falta */}
          {!canSend && !sending && (
            <div className="rounded-xl p-4 space-y-2"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
                O que falta
              </p>
              <ChecklistItem done={!!voucher} label="Escolher voucher" />
              <ChecklistItem done={!!mensagem} label="Escolher mensagem" />
              <ChecklistItem done={alvos.length > 0} label={`Selecionar ${mode === 'individual' ? 'um cliente' : 'os clientes'}`} />
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

/* ─── Helpers Mission Control ─── */
function SectionCard({ number, title, subtitle, done, icon, children }: {
  number: number; title: string; subtitle: string; done: boolean; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl overflow-hidden animate-fade-in"
      style={{
        background: 'var(--color-surface-2)',
        border: `1px solid ${done ? 'color-mix(in srgb, var(--color-brand) 25%, var(--color-border))' : 'var(--color-border)'}`,
        boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 8px 32px -16px rgba(0,0,0,0.06)',
      }}>
      <header className="flex items-center gap-3 px-5 py-3.5"
        style={{ background: done ? 'color-mix(in srgb, var(--color-brand) 4%, var(--color-surface-3))' : 'var(--color-surface-3)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'var(--color-brand)',
            boxShadow: '0 4px 12px -4px color-mix(in srgb, var(--color-brand) 50%, transparent)',
          }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--color-brand)' }}>
              Passo {number}
            </span>
            {done && <CheckCircle2 size={11} style={{ color: '#16a34a' }} />}
          </div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', letterSpacing: '-0.01em', lineHeight: 1.1, marginTop: 1 }}>
            {title}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function ResumoLinha({ label, value, hint, light }: { label: string; value: string | null; hint?: string; light: boolean }) {
  const baseColor = light ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)'
  const valColor  = value ? (light ? 'white' : 'var(--color-text)') : baseColor
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs" style={{ color: baseColor }}>{label}</span>
      <div className="text-right min-w-0">
        <span className="text-sm font-bold truncate inline-block max-w-full"
          style={{ fontFamily: 'var(--font-display)', color: valColor, letterSpacing: '0.02em' }}>
          {value ?? '—'}
        </span>
        {hint && <p className="text-[10px]" style={{ color: baseColor }}>{hint}</p>}
      </div>
    </div>
  )
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
        style={done
          ? { background: '#16a34a', color: 'white' }
          : { background: 'var(--color-surface-3)', border: '1px dashed var(--color-border)' }}>
        {done && <CheckCircle2 size={10} />}
      </span>
      <span className="text-xs" style={{ color: done ? 'var(--color-text)' : 'var(--color-text-muted)', textDecoration: done ? 'line-through' : 'none' }}>
        {label}
      </span>
    </div>
  )
}

/* ══════════════════════════════════════════
   VoucherPicker — seletor inteligente
   < 6 vouchers: pills · ≥ 6: busca + grid
═══════════════════════════════════════════ */
function VoucherPicker({ vouchers, voucherId, setVoucherId, hideHeader }: {
  vouchers: Voucher[]; voucherId: number | null; setVoucherId: (id: number) => void; hideHeader?: boolean
}) {
  const [search, setSearch] = useState('')
  const selected = vouchers.find((v) => v.id === voucherId)
  const filtered = search.trim()
    ? vouchers.filter((v) =>
        v.codigo.toLowerCase().includes(search.toLowerCase()) ||
        (v.descricao ?? '').toLowerCase().includes(search.toLowerCase()))
    : vouchers

  return (
    <div className={hideHeader ? '' : 'rounded-2xl p-5'} style={hideHeader ? {} : { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
            1 · Qual voucher quer enviar?
          </p>
          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            {vouchers.length} disponíveis
          </span>
        </div>
      )}

      {/* Card destacado do voucher selecionado */}
      {selected ? (
        <div className="mb-3 rounded-xl overflow-hidden flex items-stretch animate-fade-in"
          style={{ background: 'color-mix(in srgb, var(--color-brand) 5%, var(--color-surface))', border: '1.5px solid color-mix(in srgb, var(--color-brand) 35%, transparent)', boxShadow: '0 4px 16px -8px color-mix(in srgb, var(--color-brand) 40%, transparent)' }}>
          <div className="flex flex-col items-center justify-center px-4 py-3"
            style={{ background: 'var(--color-brand)', borderRight: '1.5px dashed color-mix(in srgb, white 50%, var(--color-brand))' }}>
            <Ticket size={20} className="text-white mb-1" />
            <span className="text-[8px] font-bold uppercase tracking-widest text-white opacity-80">Ativo</span>
          </div>
          <div className="flex-1 px-4 py-3">
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-brand)', letterSpacing: '0.04em', lineHeight: 1 }}>
              {selected.codigo}
            </p>
            {selected.descricao && (
              <p className="text-xs mt-1.5 line-clamp-1" style={{ color: 'var(--color-text)' }}>{selected.descricao}</p>
            )}
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Será enviado este voucher
            </p>
          </div>
          {selected.valor != null && selected.valor > 0 && (
            <div className="flex flex-col justify-center px-4 py-3 text-right border-l" style={{ borderColor: 'color-mix(in srgb, var(--color-brand) 20%, transparent)' }}>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Valor</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-brand)', lineHeight: 1 }}>
                {fmt(selected.valor)}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-3 px-4 py-3 rounded-xl text-xs italic"
          style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}>
          Nenhum voucher selecionado abaixo
        </div>
      )}

      {/* Busca se >5 vouchers */}
      {vouchers.length > 5 && (
        <div className="relative mb-3">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text" placeholder="Buscar voucher por código ou descrição..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
          />
        </div>
      )}

      {/* Lista compacta de outros vouchers */}
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--color-text-muted)' }}>
        Trocar voucher
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="col-span-full text-xs text-center py-3 italic" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum voucher encontrado
          </p>
        ) : filtered.map((v) => {
          const isActive = voucherId === v.id
          return (
            <button key={v.id} onClick={() => setVoucherId(v.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-left transition-all active:scale-95"
              style={isActive
                ? { background: 'var(--color-brand)', color: 'white', boxShadow: '0 2px 8px -2px color-mix(in srgb, var(--color-brand) 50%, transparent)' }
                : { background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
              <Ticket size={11} className="shrink-0" />
              <span className="truncate" style={{ fontFamily: 'var(--font-display)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.02em' }}>
                {v.codigo}
              </span>
              {v.valor != null && v.valor > 0 && (
                <span className="ml-auto text-[10px] shrink-0 opacity-70">{fmt(v.valor)}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
