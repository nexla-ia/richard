"use client";

import { useState, useEffect, useRef } from "react";
import {
  Send, Users, CheckCircle, Clock, MessageSquare,
  Loader2, DollarSign, AlertCircle, ChevronDown, ChevronUp,
  Plus, X, Trash2, Upload, FileSpreadsheet, CheckCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status = "pendente" | "cobrado" | "pago";

type Cliente = {
  id: number;
  nome: string;
  valor: number;
  telefone: string;
  dia_cobranca: number;
  status: Status;
  cobrado_em?: string;
};


const WEBHOOK_URL = "https://n8n.nexladesenvolvimento.com.br/webhook/0b4f66aa-9c8f-49e8-bb6b-91371f390ead";

const STATUS_CFG = {
  pendente: { label: "Pendente", color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)", icon: Clock },
  cobrado:  { label: "Cobrado",  color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.25)", icon: Send },
  pago:     { label: "Pago",     color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)", icon: CheckCircle },
} satisfies Record<Status, { label: string; color: string; bg: string; border: string; icon: React.ElementType }>;

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function defaultMsg(c: Cliente) {
  return `Olá ${c.nome}! Passando para lembrar que sua cobrança de ${fmt(c.valor)} vence no dia ${c.dia_cobranca}. Qualquer dúvida, estou à disposição!`;
}
async function dispararWebhook(payload: object): Promise<boolean> {
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch { return false; }
}

function StatusBadge({ status, onClick, title }: { status: Status; onClick?: () => void; title?: string }) {
  const cfg = STATUS_CFG[status];
  const Icon = cfg.icon;
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-[0.95]"
      style={{
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <Icon size={10} />
      {cfg.label}
    </button>
  );
}

function Avatar({ nome }: { nome: string }) {
  const initials = nome.trim().split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
      style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
    >
      {initials}
    </div>
  );
}

type PageTab = "cobrancas" | "pagamentos";
type ChargeMode = "individual" | "massa";

const COUNTRIES = [
  { flag: "🇧🇷", name: "Brasil",        code: "+55",  mask: "(##) #####-####",  max: 11 },
  { flag: "🇵🇹", name: "Portugal",      code: "+351", mask: "### ### ###",       max: 9  },
  { flag: "🇺🇸", name: "EUA",           code: "+1",   mask: "(###) ###-####",    max: 10 },
  { flag: "🇦🇷", name: "Argentina",     code: "+54",  mask: "## ####-####",      max: 10 },
  { flag: "🇨🇱", name: "Chile",         code: "+56",  mask: "# ####-####",       max: 9  },
  { flag: "🇨🇴", name: "Colômbia",      code: "+57",  mask: "### ###-####",      max: 10 },
  { flag: "🇲🇽", name: "México",        code: "+52",  mask: "## ####-####",      max: 10 },
  { flag: "🇵🇾", name: "Paraguai",      code: "+595", mask: "### ###-###",       max: 9  },
  { flag: "🇺🇾", name: "Uruguai",       code: "+598", mask: "### ##-##-##",      max: 9  },
  { flag: "🇧🇴", name: "Bolívia",       code: "+591", mask: "########",          max: 8  },
  { flag: "🇵🇪", name: "Peru",          code: "+51",  mask: "### ###-###",       max: 9  },
  { flag: "🇪🇨", name: "Equador",       code: "+593", mask: "## ###-####",       max: 9  },
  { flag: "🇬🇧", name: "Reino Unido",   code: "+44",  mask: "#### ### ####",     max: 10 },
  { flag: "🇩🇪", name: "Alemanha",      code: "+49",  mask: "#### #######",      max: 11 },
  { flag: "🇫🇷", name: "França",        code: "+33",  mask: "# ## ## ## ##",     max: 9  },
  { flag: "🇪🇸", name: "Espanha",       code: "+34",  mask: "### ### ###",       max: 9  },
  { flag: "🇮🇹", name: "Itália",        code: "+39",  mask: "### #### ###",      max: 10 },
  { flag: "🇯🇵", name: "Japão",         code: "+81",  mask: "##-####-####",      max: 10 },
  { flag: "🇨🇳", name: "China",         code: "+86",  mask: "### ####-####",     max: 11 },
  { flag: "🇮🇳", name: "Índia",         code: "+91",  mask: "##### #####",       max: 10 },
];

export default function CobrancasPage() {
  const supabase = createClient();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageTab, setPageTab] = useState<PageTab>("cobrancas");
  const [chargeMode, setChargeMode] = useState<ChargeMode>("individual");
  const [filterStatus, setFilterStatus] = useState<Status | "todos">("todos");

  const [openId, setOpenId]     = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<Record<number, string>>({});
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [errorId, setErrorId]   = useState<number | null>(null);

  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set());
  const [mensagemMassa, setMensagemMassa] = useState("");
  const [sendingMassa, setSendingMassa] = useState(false);
  const [sentMassa, setSentMassa]       = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nome: "", telefone: "", valor: "", dia_cobranca: "5" });
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showCountries, setShowCountries] = useState(false);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; clienteId: number } | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<{ nome: string; telefone: string; valor: string; dia_cobranca: string }[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Carrega clientes do banco
  useEffect(() => {
    let uid: string | null = null;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      uid = session.user.id;
      const { data } = await supabase
        .from("clientes")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (data) setClientes(data as Cliente[]);
      setLoading(false);
    }
    load();
    const channel = supabase
      .channel("clientes-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  function openCtxMenu(e: React.MouseEvent, id: number) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, clienteId: id });
  }

  async function addCliente() {
    const v = parseFloat(form.valor.replace(",", "."));
    if (!form.nome.trim() || isNaN(v)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("clientes").insert({
      user_id: user.id,
      nome: form.nome.trim(),
      telefone: form.telefone.trim() ? `${country.code} ${form.telefone.trim()}` : "",
      valor: v,
      dia_cobranca: Math.min(28, Math.max(1, Number(form.dia_cobranca) || 1)),
      status: "pendente",
    }).select().single();
    if (!error && data) setClientes((p) => [data as Cliente, ...p]);
    setForm({ nome: "", telefone: "", valor: "", dia_cobranca: "5" });
    setShowModal(false);
  }

  const totals = {
    pendente: clientes.filter((c) => c.status === "pendente").reduce((a, c) => a + c.valor, 0),
    cobrado:  clientes.filter((c) => c.status === "cobrado").reduce((a, c) => a + c.valor, 0),
    pago:     clientes.filter((c) => c.status === "pago").reduce((a, c) => a + c.valor, 0),
  };

  const listaCobrar = clientes.filter((c) =>
    filterStatus === "todos" || c.status === filterStatus
  );

  function getMensagem(c: Cliente) { return mensagens[c.id] ?? defaultMsg(c); }

  async function setStatus(id: number, status: Status, cobrado_em?: string) {
    setClientes((p) => p.map((c) => c.id === id ? { ...c, status, ...(cobrado_em ? { cobrado_em } : {}) } : c));
    await supabase.from("clientes").update({ status, ...(cobrado_em ? { cobrado_em } : {}) }).eq("id", id);
  }

  async function deleteCliente(id: number) {
    setClientes((p) => p.filter((c) => c.id !== id));
    await supabase.from("clientes").delete().eq("id", id);
  }

  async function cobrarUm(c: Cliente) {
    setSendingId(c.id); setErrorId(null);
    const hoje = new Date().toLocaleDateString("pt-BR");
    const ok = await dispararWebhook({ nome: c.nome, telefone: c.telefone, valor: c.valor, dia_cobranca: c.dia_cobranca, mensagem: getMensagem(c) });
    setSendingId(null);
    if (ok) { setStatus(c.id, "cobrado", hoje); setOpenId(null); }
    else setErrorId(c.id);
  }

  async function cobrarMassa() {
    const alvos = clientes.filter((c) => selectedIds.has(c.id));
    if (!alvos.length) return;
    setSendingMassa(true);
    const hoje = new Date().toLocaleDateString("pt-BR");
    await Promise.all(alvos.map((c) =>
      dispararWebhook({ nome: c.nome, telefone: c.telefone, valor: c.valor, dia_cobranca: c.dia_cobranca, mensagem: mensagemMassa || defaultMsg(c) })
    ));
    const ids = [...selectedIds];
    setClientes((p) => p.map((c) => selectedIds.has(c.id) ? { ...c, status: "cobrado", cobrado_em: hoje } : c));
    await supabase.from("clientes").update({ status: "cobrado", cobrado_em: hoje }).in("id", ids);
    setSendingMassa(false); setSentMassa(true); setSelectedIds(new Set());
    setTimeout(() => setSentMassa(false), 3000);
  }

  function toggleSelect(id: number) {
    setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function cyclePago(c: Cliente) {
    if (c.status === "pendente") return;
    setStatus(c.id, c.status === "cobrado" ? "pago" : "cobrado");
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      // skip header row if first cell looks like a label
      const start = isNaN(parseFloat(lines[0]?.split(/[,;]/)[2]?.replace(",", "."))) ? 1 : 0;
      const rows = lines.slice(start).map((line) => {
        const cols = line.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ""));
        return { nome: cols[0] ?? "", telefone: cols[1] ?? "", valor: cols[2] ?? "", dia_cobranca: cols[3] ?? "5" };
      }).filter((r) => r.nome);
      setImportRows(rows);
      setImportDone(false);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleImportSubmit() {
    if (!importRows.length) return;
    setImportLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setImportLoading(false); return; }
    const uid = session.user.id;
    const toInsert = importRows.map((r) => ({
      user_id: uid,
      nome: r.nome,
      telefone: r.telefone,
      valor: parseFloat(r.valor.replace(",", ".")) || 0,
      dia_cobranca: Math.min(28, Math.max(1, parseInt(r.dia_cobranca) || 5)),
      status: "pendente" as Status,
    }));
    const { data } = await supabase.from("clientes").insert(toInsert).select();
    if (data) setClientes((p) => [...(data as Cliente[]), ...p]);
    setImportLoading(false);
    setImportDone(true);
    setTimeout(() => { setShowImport(false); setImportRows([]); setImportDone(false); }, 1500);
  }

  /* ── shared table head style ── */
  const thStyle: React.CSSProperties = {
    background: "var(--color-surface-3)",
    color: "var(--color-text-muted)",
    borderBottom: "1px solid var(--color-border)",
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Cobranças
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Gerencie e acompanhe o status de cada cliente
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowImport(true); setImportRows([]); setImportDone(false); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
            style={{ background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-brand)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
          >
            <FileSpreadsheet size={15} /> Importar planilha
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
            style={{ background: "var(--color-brand)", color: "white" }}
          >
            <Plus size={15} /> Novo cliente
          </button>

          {/* Page tabs */}
          <div
            className="flex rounded-xl p-1 gap-1"
            style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)" }}
          >
            {(["cobrancas", "pagamentos"] as PageTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setPageTab(tab)}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.95] capitalize"
                style={pageTab === tab
                  ? { background: "var(--color-brand)", color: "white" }
                  : { color: "var(--color-text-muted)" }}
              >
                {tab === "cobrancas" ? "Cobranças" : "Pagamentos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(["pendente", "cobrado", "pago"] as Status[]).map((key) => {
          const cfg   = STATUS_CFG[key];
          const Icon  = cfg.icon;
          const count = clientes.filter((c) => c.status === key).length;
          return (
            <div
              key={key}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderLeft: `3px solid ${cfg.color}`,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: cfg.bg }}
              >
                <Icon size={18} style={{ color: cfg.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium mb-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {cfg.label}
                </p>
                <p className="text-xl font-bold leading-none" style={{ fontFamily: "var(--font-display)" }}>
                  {count}{" "}
                  <span className="text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>
                    cliente{count !== 1 ? "s" : ""}
                  </span>
                </p>
                <p className="text-xs mt-1 font-medium" style={{ color: cfg.color }}>
                  {fmt(totals[key])}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ════ ABA COBRANÇAS ════ */}
      {pageTab === "cobrancas" && (
        <div>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            {/* Mode */}
            <div
              className="flex rounded-xl p-1 gap-1"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)" }}
            >
              {([["individual", MessageSquare, "Um por vez"], ["massa", Users, "Em massa"]] as const).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  onClick={() => setChargeMode(mode)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.95]"
                  style={chargeMode === mode
                    ? { background: "var(--color-brand)", color: "white" }
                    : { color: "var(--color-text-muted)" }}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              {(["todos", "pendente", "cobrado", "pago"] as const).map((s) => {
                const active = filterStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.95]"
                    style={active
                      ? { background: "var(--color-brand)", color: "white" }
                      : { background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                  >
                    {s === "todos" ? "Todos" : STATUS_CFG[s].label}
                    {s !== "todos" && (
                      <span className="ml-1.5 opacity-60">{clientes.filter((c) => c.status === s).length}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Individual ── */}
          {chargeMode === "individual" && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
              <div
                className="grid text-xs font-semibold uppercase tracking-wider px-5 py-3"
                style={{ ...thStyle, gridTemplateColumns: "1fr 140px 90px 120px 120px" }}
              >
                <span>Cliente</span>
                <span>Valor</span>
                <span>Vencimento</span>
                <span>Status</span>
                <span />
              </div>

              {listaCobrar.length === 0 && (
                <div className="py-12 text-center text-sm" style={{ color: "var(--color-text-muted)", background: "var(--color-surface-2)" }}>
                  Nenhum cliente para este filtro.
                </div>
              )}

              {listaCobrar.map((c) => {
                const isOpen    = openId === c.id;
                const isSending = sendingId === c.id;
                const hasError  = errorId === c.id;
                return (
                  <div key={c.id}>
                    <div
                      className="grid items-center px-5 py-3.5 text-sm transition-colors"
                      onContextMenu={(e) => openCtxMenu(e, c.id)}
                      style={{
                        gridTemplateColumns: "1fr 140px 90px 120px 120px",
                        background: isOpen
                          ? "color-mix(in srgb, var(--color-brand) 5%, var(--color-surface-2))"
                          : "var(--color-surface-2)",
                        borderBottom: "1px solid var(--color-border)",
                        borderLeft: `2px solid ${isOpen ? "var(--color-brand)" : "transparent"}`,
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar nome={c.nome} />
                        <div className="min-w-0">
                          <p className="font-semibold truncate" style={{ color: "var(--color-text)" }}>{c.nome}</p>
                          <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{c.telefone}</p>
                        </div>
                      </div>

                      <span className="font-semibold" style={{ color: "var(--color-brand)" }}>
                        {fmt(c.valor)}
                      </span>

                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        Dia {c.dia_cobranca}
                      </span>

                      <StatusBadge status={c.status} />

                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          onClick={() => { setOpenId(isOpen ? null : c.id); setErrorId(null); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.95]"
                          style={isOpen
                            ? { background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }
                            : { background: "var(--color-brand)", color: "white" }}
                        >
                          <Send size={11} />
                          {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                        <button
                          onClick={() => deleteCliente(c.id)}
                          title="Deletar cliente"
                          className="p-1.5 rounded-lg transition-all active:scale-[0.95]"
                          style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)", background: "var(--color-surface-3)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.4)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div
                        className="px-5 py-4"
                        style={{
                          background: "var(--color-surface-3)",
                          borderBottom: "1px solid var(--color-border)",
                          borderLeft: "2px solid var(--color-brand)",
                        }}
                      >
                        <p className="text-xs font-medium mb-2" style={{ color: "var(--color-text-muted)" }}>
                          Mensagem a ser enviada — edite se necessário
                        </p>
                        <textarea
                          rows={3}
                          value={getMensagem(c)}
                          onChange={(e) => setMensagens((p) => ({ ...p, [c.id]: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none mb-3"
                          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)", lineHeight: 1.6 }}
                          onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                          onBlur={(e)  => (e.target.style.borderColor = "var(--color-border)")}
                        />
                        {hasError && (
                          <div className="flex items-center gap-2 mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                            <AlertCircle size={12} /> Falha ao enviar. Verifique a conexão.
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => cobrarUm(c)}
                            disabled={isSending}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                            style={{ background: "var(--color-brand)", color: "white", opacity: isSending ? 0.7 : 1 }}
                          >
                            {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                            {isSending ? "Enviando..." : "Enviar cobrança"}
                          </button>
                          <button
                            onClick={() => { setOpenId(null); setErrorId(null); }}
                            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                            style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Em massa ── */}
          {chargeMode === "massa" && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
                <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
                  Mensagem personalizada{" "}
                  <span className="font-normal text-xs" style={{ color: "var(--color-text-muted)" }}>
                    — deixe vazio para usar a mensagem padrão de cada cliente
                  </span>
                </p>
                <textarea
                  rows={3}
                  placeholder="Ex: Olá! Lembrando que sua mensalidade está disponível para pagamento..."
                  value={mensagemMassa}
                  onChange={(e) => setMensagemMassa(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none mb-3"
                  style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)", lineHeight: 1.6 }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                  onBlur={(e)  => (e.target.style.borderColor = "var(--color-border)")}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSelectedIds(new Set(clientes.filter((c) => c.status === "pendente").map((c) => c.id)))}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.95]"
                    style={{ background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                  >
                    Selecionar pendentes
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.95]"
                      style={{ background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                    >
                      Limpar
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    {sentMassa && (
                      <span className="text-xs flex items-center gap-1" style={{ color: "#34d399" }}>
                        <CheckCircle size={12} /> Enviado com sucesso!
                      </span>
                    )}
                    <button
                      onClick={cobrarMassa}
                      disabled={sendingMassa || selectedIds.size === 0}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                      style={{
                        background: selectedIds.size === 0 ? "var(--color-surface-3)" : "var(--color-brand)",
                        color: selectedIds.size === 0 ? "var(--color-text-muted)" : "white",
                      }}
                    >
                      {sendingMassa ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      {sendingMassa ? "Enviando..." : `Enviar para ${selectedIds.size} cliente${selectedIds.size !== 1 ? "s" : ""}`}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                <div
                  className="grid text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ ...thStyle, gridTemplateColumns: "32px 1fr 140px 90px 120px" }}
                >
                  <span /><span>Cliente</span><span>Valor</span><span>Vencimento</span><span>Status</span>
                </div>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="grid items-center px-5 py-3.5"
                      style={{ gridTemplateColumns: "32px 1fr 140px 90px 120px", background: "var(--color-surface-2)", borderBottom: "1px solid var(--color-border)" }}>
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
                  <div
                    key={c.id}
                    className="grid items-center px-5 py-3.5 text-sm cursor-pointer transition-colors animate-fade-in"
                    style={{
                      gridTemplateColumns: "32px 1fr 140px 90px 120px",
                      background: selectedIds.has(c.id)
                        ? "color-mix(in srgb, var(--color-brand) 7%, var(--color-surface-2))"
                        : "var(--color-surface-2)",
                      borderBottom: "1px solid var(--color-border)",
                      borderLeft: `2px solid ${selectedIds.has(c.id) ? "var(--color-brand)" : "transparent"}`,
                      animationDelay: `${i * 35}ms`,
                    }}
                    onClick={() => toggleSelect(c.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      style={{ accentColor: "var(--color-brand)" }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar nome={c.nome} />
                      <div className="min-w-0">
                        <p className="font-semibold truncate" style={{ color: "var(--color-text)" }}>{c.nome}</p>
                        <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{c.telefone}</p>
                      </div>
                    </div>
                    <span className="font-semibold" style={{ color: "var(--color-brand)" }}>{fmt(c.valor)}</span>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Dia {c.dia_cobranca}</span>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ ABA PAGAMENTOS ════ */}
      {pageTab === "pagamentos" && (
        <div>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
            <div
              className="grid text-xs font-semibold uppercase tracking-wider px-5 py-3"
              style={{ ...thStyle, gridTemplateColumns: "1fr 140px 130px 130px" }}
            >
              <span>Cliente</span><span>Valor</span><span>Cobrado em</span><span>Status</span>
            </div>

            {clientes.map((c) => (
              <div
                key={c.id}
                className="grid items-center px-5 py-3.5 text-sm"
                style={{
                  gridTemplateColumns: "1fr 140px 130px 130px",
                  background: "var(--color-surface-2)",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar nome={c.nome} />
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ color: "var(--color-text)" }}>{c.nome}</p>
                    <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{c.telefone}</p>
                  </div>
                </div>
                <span className="font-semibold" style={{ color: "var(--color-brand)" }}>{fmt(c.valor)}</span>
                <span className="text-xs" style={{ color: c.cobrado_em ? "var(--color-text-muted)" : "var(--color-border)" }}>
                  {c.cobrado_em ?? "—"}
                </span>
                <StatusBadge
                  status={c.status}
                  onClick={c.status !== "pendente" ? () => cyclePago(c) : undefined}
                  title={c.status !== "pendente" ? "Clique para alternar entre Cobrado e Pago" : undefined}
                />
              </div>
            ))}
          </div>

          <div
            className="flex items-center justify-between mt-4 px-5 py-3 rounded-2xl text-xs"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            <span className="flex items-center gap-1.5">
              <DollarSign size={12} style={{ color: "var(--color-brand)" }} />
              Clique no status para alternar entre{" "}
              <strong style={{ color: STATUS_CFG.cobrado.color }}>Cobrado</strong> e{" "}
              <strong style={{ color: STATUS_CFG.pago.color }}>Pago</strong>
            </span>
            <div className="flex items-center gap-4">
              <span>Cobrado: <strong style={{ color: STATUS_CFG.cobrado.color }}>{fmt(totals.cobrado)}</strong></span>
              <span>Pago: <strong style={{ color: STATUS_CFG.pago.color }}>{fmt(totals.pago)}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* ── Context menu de status ── */}
      {ctxMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setCtxMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}
        >
          <div
            className="absolute rounded-xl overflow-hidden py-1"
            style={{
              top: ctxMenu.y,
              left: ctxMenu.x,
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              minWidth: "180px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
              Alterar status
            </p>
            {(["pendente", "cobrado", "pago"] as Status[]).map((s) => {
              const cfg = STATUS_CFG[s];
              const Icon = cfg.icon;
              const isCurrent = clientes.find((c) => c.id === ctxMenu.clienteId)?.status === s;
              return (
                <button
                  key={s}
                  onClick={() => { setStatus(ctxMenu.clienteId, s); setCtxMenu(null); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all"
                  style={{
                    background: isCurrent ? "color-mix(in srgb, var(--color-brand) 10%, transparent)" : "transparent",
                    color: isCurrent ? cfg.color : "var(--color-text)",
                  }}
                  onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = "var(--color-surface-3)"; }}
                  onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
                >
                  <Icon size={13} style={{ color: cfg.color }} />
                  <span>{cfg.label}</span>
                  {isCurrent && <span className="ml-auto text-xs opacity-60">atual</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modal importar planilha ── */}
      {showImport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowImport(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl flex flex-col gap-5 p-6 animate-fade-in"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet size={18} style={{ color: "var(--color-brand)" }} />
                <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Importar planilha</h2>
              </div>
              <button onClick={() => setShowImport(false)} className="p-1.5 rounded-lg" style={{ color: "var(--color-text-muted)" }}><X size={16} /></button>
            </div>

            {/* Formato esperado */}
            <div className="p-3 rounded-xl text-xs" style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
              <p className="font-semibold mb-1" style={{ color: "var(--color-text)" }}>Formato esperado (CSV):</p>
              <p>Colunas em ordem: <strong>Nome, Telefone, Valor, Dia de cobrança</strong></p>
              <p className="mt-1 font-mono" style={{ color: "var(--color-brand)" }}>João Silva, 11999990000, 150.00, 10</p>
              <p className="mt-1">Separador: vírgula ou ponto-e-vírgula. A 1ª linha pode ser cabeçalho.</p>
            </div>

            {/* Área de upload */}
            <input ref={importInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleImportFile} />
            {importRows.length === 0 ? (
              <button
                onClick={() => importInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed transition-all"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; e.currentTarget.style.color = "var(--color-brand)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--color-text-muted)"; }}
              >
                <Upload size={28} />
                <span className="text-sm font-medium">Clique para selecionar arquivo .csv</span>
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{importRows.length} cliente{importRows.length !== 1 ? "s" : ""} encontrado{importRows.length !== 1 ? "s" : ""}</span>
                  <button onClick={() => importInputRef.current?.click()} className="text-xs px-2 py-1 rounded-lg" style={{ color: "var(--color-brand)", border: "1px solid rgba(99,102,241,0.3)" }}>Trocar arquivo</button>
                </div>
                {/* Preview */}
                <div className="rounded-xl overflow-hidden max-h-48 overflow-y-auto" style={{ border: "1px solid var(--color-border)" }}>
                  <div className="grid text-xs font-semibold uppercase px-3 py-2" style={{ gridTemplateColumns: "1fr 120px 80px 60px", background: "var(--color-surface-3)", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
                    <span>Nome</span><span>Telefone</span><span>Valor</span><span>Dia</span>
                  </div>
                  {importRows.map((r, i) => (
                    <div key={i} className="grid items-center px-3 py-2 text-xs" style={{ gridTemplateColumns: "1fr 120px 80px 60px", background: i % 2 === 0 ? "var(--color-surface-2)" : "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
                      <span className="truncate font-medium">{r.nome}</span>
                      <span className="truncate" style={{ color: "var(--color-text-muted)" }}>{r.telefone || "—"}</span>
                      <span style={{ color: "var(--color-brand)" }}>{r.valor}</span>
                      <span style={{ color: "var(--color-text-muted)" }}>{r.dia_cobranca}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleImportSubmit}
                  disabled={importLoading || importDone}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                  style={{ background: importDone ? "rgba(52,211,153,0.15)" : "var(--color-brand)", color: importDone ? "#34d399" : "white", border: importDone ? "1px solid rgba(52,211,153,0.3)" : "none" }}
                >
                  {importLoading ? <><Loader2 size={14} className="animate-spin" /> Importando...</>
                   : importDone ? <><CheckCheck size={14} /> Importado com sucesso!</>
                   : <><Upload size={14} /> Importar {importRows.length} cliente{importRows.length !== 1 ? "s" : ""}</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal novo cliente ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>Novo cliente</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "var(--color-text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            {/* Nome */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Nome</label>
              <input
                type="text"
                placeholder="João Silva"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addCliente()}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
              />
            </div>

            {/* Telefone com seletor de país */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Telefone</label>
              <div className="flex gap-2 relative">
                {/* Botão país */}
                <button
                  type="button"
                  onClick={() => setShowCountries((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium shrink-0 transition-all active:scale-[0.97]"
                  style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                >
                  <span>{country.flag}</span>
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{country.code}</span>
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>▾</span>
                </button>

                {/* Dropdown países */}
                {showCountries && (
                  <div
                    className="absolute top-full left-0 mt-1 z-10 rounded-xl overflow-hidden overflow-y-auto"
                    style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", maxHeight: "220px", minWidth: "220px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                  >
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.code + c.name}
                        type="button"
                        onClick={() => { setCountry(c); setShowCountries(false); setForm((p) => ({ ...p, telefone: "" })); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-all"
                        style={{
                          background: country.code === c.code ? "color-mix(in srgb, var(--color-brand) 12%, transparent)" : "transparent",
                          color: "var(--color-text)",
                        }}
                        onMouseEnter={(e) => { if (country.code !== c.code) e.currentTarget.style.background = "var(--color-surface-3)"; }}
                        onMouseLeave={(e) => { if (country.code !== c.code) e.currentTarget.style.background = "transparent"; }}
                      >
                        <span className="text-base">{c.flag}</span>
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="text-xs shrink-0" style={{ color: "var(--color-text-muted)" }}>{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Input número */}
                <input
                  type="tel"
                  placeholder={country.mask.replace(/#/g, "0")}
                  value={form.telefone}
                  maxLength={country.max + 4}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, country.max);
                    setForm((p) => ({ ...p, telefone: digits }));
                  }}
                  onKeyDown={(e) => e.key === "Enter" && addCliente()}
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                />
              </div>
              <p className="text-xs mt-1.5" style={{ color: "var(--color-text-muted)" }}>
                {form.telefone.length}/{country.max} dígitos
              </p>
            </div>

            {/* Valor */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Valor (R$)</label>
              <input
                type="text"
                placeholder="1500,00"
                value={form.valor}
                onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addCliente()}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
              />
            </div>

            {/* Dia de cobrança */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Dia de cobrança</label>
              <input
                type="number"
                placeholder="5"
                min={1}
                max={28}
                value={form.dia_cobranca}
                onChange={(e) => setForm((p) => ({ ...p, dia_cobranca: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addCliente()}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={addCliente}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                style={{ background: "var(--color-brand)", color: "white" }}
              >
                Adicionar
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                style={{ background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
