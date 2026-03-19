"use client";

import { useState } from "react";
import {
  Send, Users, CheckCircle, Clock, MessageSquare,
  Loader2, DollarSign, AlertCircle, ChevronDown, ChevronUp,
} from "lucide-react";

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

export default function CobrancasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
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

  const totals = {
    pendente: clientes.filter((c) => c.status === "pendente").reduce((a, c) => a + c.valor, 0),
    cobrado:  clientes.filter((c) => c.status === "cobrado").reduce((a, c) => a + c.valor, 0),
    pago:     clientes.filter((c) => c.status === "pago").reduce((a, c) => a + c.valor, 0),
  };

  const listaCobrar = clientes.filter((c) =>
    filterStatus === "todos" || c.status === filterStatus
  );

  function getMensagem(c: Cliente) { return mensagens[c.id] ?? defaultMsg(c); }

  function setStatus(id: number, status: Status, cobrado_em?: string) {
    setClientes((p) => p.map((c) => c.id === id ? { ...c, status, ...(cobrado_em ? { cobrado_em } : {}) } : c));
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
    setClientes((p) => p.map((c) => selectedIds.has(c.id) ? { ...c, status: "cobrado", cobrado_em: hoje } : c));
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
                style={{ ...thStyle, gridTemplateColumns: "1fr 140px 90px 120px 88px" }}
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
                      style={{
                        gridTemplateColumns: "1fr 140px 90px 120px 88px",
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

                      <button
                        onClick={() => { setOpenId(isOpen ? null : c.id); setErrorId(null); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.95] ml-auto"
                        style={isOpen
                          ? { background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }
                          : { background: "var(--color-brand)", color: "white" }}
                      >
                        <Send size={11} />
                        {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
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
                {clientes.map((c) => (
                  <div
                    key={c.id}
                    className="grid items-center px-5 py-3.5 text-sm cursor-pointer transition-colors"
                    style={{
                      gridTemplateColumns: "32px 1fr 140px 90px 120px",
                      background: selectedIds.has(c.id)
                        ? "color-mix(in srgb, var(--color-brand) 7%, var(--color-surface-2))"
                        : "var(--color-surface-2)",
                      borderBottom: "1px solid var(--color-border)",
                      borderLeft: `2px solid ${selectedIds.has(c.id) ? "var(--color-brand)" : "transparent"}`,
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
    </div>
  );
}
