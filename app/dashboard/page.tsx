import { TrendingUp, ClipboardList, CreditCard, AlertCircle } from "lucide-react";
import Link from "next/link";

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function DashboardPage() {
  const totalGestao   = 0;
  const totalPago     = 0;
  const totalPendente = 0;
  const totalVencido  = 0;

  const recentGestoes: { id: number; nome: string; valor: number; feito: string }[]   = [];
  const recentCobrancas: { id: number; nome: string; valor: number; status: string; vencimento: string }[] = [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const stats = [
    {
      label: "Total em Gestões",
      value: formatCurrency(totalGestao),
      icon: <TrendingUp size={20} />,
      href: "/dashboard/gestoes",
      color: "var(--color-brand)",
    },
    {
      label: "Cobranças Pagas",
      value: formatCurrency(totalPago),
      icon: <CreditCard size={20} />,
      href: "/dashboard/cobrancas",
      color: "#4ade80",
    },
    {
      label: "Pendente",
      value: formatCurrency(totalPendente),
      icon: <ClipboardList size={20} />,
      href: "/dashboard/cobrancas",
      color: "#facc15",
    },
    {
      label: "Vencido",
      value: formatCurrency(totalVencido),
      icon: <AlertCircle size={20} />,
      href: "/dashboard/cobrancas",
      color: "#f87171",
    },
  ];

  return (
    <div>
      {/* Greeting */}
      <div className="mb-8">
        <h1
          className="text-3xl font-bold mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
        >
          {greeting} 👋
        </h1>
        <p style={{ color: "var(--color-text-muted)" }}>Aqui está o resumo geral da sua conta.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="p-5 rounded-2xl flex flex-col gap-3 transition-all hover:scale-[1.02]"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
          >
            <span style={{ color: s.color }}>{s.icon}</span>
            <div>
              <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                {s.value}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {s.label}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent rows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gestões recentes */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-3)" }}
          >
            <span className="font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>
              Últimas Gestões
            </span>
            <Link href="/dashboard/gestoes" className="text-xs" style={{ color: "var(--color-brand)" }}>
              Ver todas
            </Link>
          </div>
          {recentGestoes.map((g, i) => (
            <div
              key={g.id}
              className="flex items-center justify-between px-5 py-3 text-sm"
              style={{
                background: i % 2 === 0 ? "var(--color-surface-2)" : "var(--color-surface)",
                borderBottom: i < recentGestoes.length - 1 ? "1px solid var(--color-border)" : "none",
              }}
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{g.nome}</p>
                <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                  {g.feito}
                </p>
              </div>
              <span className="ml-4 font-semibold shrink-0" style={{ color: "var(--color-brand)" }}>
                {formatCurrency(g.valor)}
              </span>
            </div>
          ))}
        </div>

        {/* Cobranças recentes */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-3)" }}
          >
            <span className="font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>
              Cobranças Recentes
            </span>
            <Link href="/dashboard/cobrancas" className="text-xs" style={{ color: "var(--color-brand)" }}>
              Ver todas
            </Link>
          </div>
          {recentCobrancas.map((c, i) => {
            const statusColor =
              c.status === "pago" ? "#4ade80" : c.status === "vencido" ? "#f87171" : "#facc15";
            const statusLabel =
              c.status === "pago" ? "Pago" : c.status === "vencido" ? "Vencido" : "Pendente";
            return (
              <div
                key={c.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
                style={{
                  background: i % 2 === 0 ? "var(--color-surface-2)" : "var(--color-surface)",
                  borderBottom: i < recentCobrancas.length - 1 ? "1px solid var(--color-border)" : "none",
                }}
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.nome}</p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Vence {new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="ml-4 flex flex-col items-end gap-1 shrink-0">
                  <span className="font-semibold" style={{ color: "var(--color-text)" }}>
                    {formatCurrency(c.valor)}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${statusColor}20`, color: statusColor }}
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
