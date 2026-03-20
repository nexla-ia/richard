"use client";

import { useState, useEffect } from "react";
import { TrendingUp, ClipboardList, CreditCard, AlertCircle } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Gestao   = { id: number; nome: string; valor: number; data: string; feito: string };
type Cliente  = { id: number; nome: string; valor: number; status: string; dia_cobranca: number };

export default function DashboardPage() {
  const supabase = createClient();

  const [gestoes,   setGestoes]   = useState<Gestao[]>([]);
  const [clientes,  setClientes]  = useState<Cliente[]>([]);

  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingTotals, setLoadingTotals] = useState(true);

  const [allGestoes,  setAllGestoes]  = useState<{ valor: number }[]>([]);
  const [allClientes, setAllClientes] = useState<{ valor: number; status: string }[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;
      const [recent, totals] = await Promise.all([
        Promise.all([
          supabase.from("gestoes").select("id,nome,valor,data,feito").eq("user_id", uid).order("data", { ascending: false }).limit(4),
          supabase.from("clientes").select("id,nome,valor,status,dia_cobranca").eq("user_id", uid).order("created_at", { ascending: false }).limit(4),
        ]),
        Promise.all([
          supabase.from("gestoes").select("valor").eq("user_id", uid),
          supabase.from("clientes").select("valor,status").eq("user_id", uid),
        ]),
      ]);
      const [g, c] = recent;
      const [ag, ac] = totals;
      if (g.data) setGestoes(g.data as Gestao[]);
      if (c.data) setClientes(c.data as Cliente[]);
      if (ag.data) setAllGestoes(ag.data);
      if (ac.data) setAllClientes(ac.data);
      setLoadingRecent(false);
      setLoadingTotals(false);
    }
    load();
    const channel = supabase
      .channel("dashboard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "gestoes" }, () => { load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalGestao   = allGestoes.reduce((a, r) => a + r.valor, 0);
  const totalPago     = allClientes.filter((c) => c.status === "pago").reduce((a, c) => a + c.valor, 0);
  const totalPendente = allClientes.filter((c) => c.status === "pendente").reduce((a, c) => a + c.valor, 0);
  const totalCobrado  = allClientes.filter((c) => c.status === "cobrado").reduce((a, c) => a + c.valor, 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const stats = [
    { label: "Total em Gestões",   value: formatCurrency(totalGestao),   icon: <TrendingUp size={20} />,  href: "/dashboard/gestoes",   color: "var(--color-brand)" },
    { label: "Cobranças Pagas",    value: formatCurrency(totalPago),      icon: <CreditCard size={20} />,  href: "/dashboard/cobrancas", color: "#4ade80" },
    { label: "Pendente",           value: formatCurrency(totalPendente),  icon: <ClipboardList size={20} />, href: "/dashboard/cobrancas", color: "#facc15" },
    { label: "Cobrado",            value: formatCurrency(totalCobrado),   icon: <AlertCircle size={20} />, href: "/dashboard/cobrancas", color: "#60a5fa" },
  ];

  const STATUS_COLOR: Record<string, string> = {
    pago:     "#4ade80",
    cobrado:  "#60a5fa",
    pendente: "#facc15",
  };
  const STATUS_LABEL: Record<string, string> = {
    pago:     "Pago",
    cobrado:  "Cobrado",
    pendente: "Pendente",
  };

  const SkeletonCard = () => (
    <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
      <span className="skeleton w-6 h-5" />
      <div className="flex flex-col gap-2">
        <span className="skeleton h-6 w-24" />
        <span className="skeleton h-3 w-16" />
      </div>
    </div>
  );

  const SkeletonListRow = ({ i }: { i: number }) => (
    <div className="flex items-center justify-between px-5 py-3"
      style={{ background: i % 2 === 0 ? "var(--color-surface-2)" : "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="skeleton h-3.5" style={{ width: `${110 + (i * 23) % 60}px` }} />
        <span className="skeleton h-2.5" style={{ width: `${70 + (i * 17) % 50}px` }} />
      </div>
      <span className="skeleton h-3.5 w-16 ml-4 shrink-0" />
    </div>
  );

  return (
    <div>
      {/* Greeting */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}>
          {greeting} 👋
        </h1>
        <p style={{ color: "var(--color-text-muted)" }}>Aqui está o resumo geral da sua conta.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loadingTotals
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : stats.map((s, i) => (
            <Link
              key={s.label}
              href={s.href}
              className="p-5 rounded-2xl flex flex-col gap-3 transition-all hover:scale-[1.02] animate-fade-in"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", animationDelay: `${i * 60}ms` }}
            >
              <span style={{ color: s.color }}>{s.icon}</span>
              <div>
                <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{s.label}</p>
              </div>
            </Link>
          ))
        }
      </div>

      {/* Recent rows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gestões recentes */}
        <div className="rounded-2xl overflow-hidden animate-fade-in" style={{ border: "1px solid var(--color-border)", animationDelay: "120ms" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-3)" }}>
            <span className="font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>Últimas Gestões</span>
            <Link href="/dashboard/gestoes" className="text-xs" style={{ color: "var(--color-brand)" }}>Ver todas</Link>
          </div>
          {loadingRecent
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonListRow key={i} i={i} />)
            : gestoes.length === 0
            ? (
              <div className="px-5 py-8 text-center text-sm animate-fade-in" style={{ color: "var(--color-text-muted)", background: "var(--color-surface-2)" }}>
                Nenhuma gestão cadastrada ainda.
              </div>
            ) : gestoes.map((g, i) => (
              <div
                key={g.id}
                className="flex items-center justify-between px-5 py-3 text-sm animate-fade-in"
                style={{ background: i % 2 === 0 ? "var(--color-surface-2)" : "var(--color-surface)", borderBottom: i < gestoes.length - 1 ? "1px solid var(--color-border)" : "none", animationDelay: `${i * 40}ms` }}
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{g.nome || "—"}</p>
                  <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{g.feito || "—"}</p>
                </div>
                <span className="ml-4 font-semibold shrink-0" style={{ color: "var(--color-brand)" }}>
                  {formatCurrency(g.valor)}
                </span>
              </div>
            ))
          }
        </div>

        {/* Cobranças recentes */}
        <div className="rounded-2xl overflow-hidden animate-fade-in" style={{ border: "1px solid var(--color-border)", animationDelay: "160ms" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-3)" }}>
            <span className="font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>Cobranças Recentes</span>
            <Link href="/dashboard/cobrancas" className="text-xs" style={{ color: "var(--color-brand)" }}>Ver todas</Link>
          </div>
          {loadingRecent
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonListRow key={i} i={i} />)
            : clientes.length === 0
            ? (
              <div className="px-5 py-8 text-center text-sm animate-fade-in" style={{ color: "var(--color-text-muted)", background: "var(--color-surface-2)" }}>
                Nenhum cliente cadastrado ainda.
              </div>
            ) : clientes.map((c, i) => {
              const color = STATUS_COLOR[c.status] ?? "#facc15";
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-5 py-3 text-sm animate-fade-in"
                  style={{ background: i % 2 === 0 ? "var(--color-surface-2)" : "var(--color-surface)", borderBottom: i < clientes.length - 1 ? "1px solid var(--color-border)" : "none", animationDelay: `${i * 40}ms` }}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.nome}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Vence dia {c.dia_cobranca}</p>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-1 shrink-0">
                    <span className="font-semibold" style={{ color: "var(--color-text)" }}>{formatCurrency(c.valor)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}20`, color }}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}
