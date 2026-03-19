"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Search, X, Trash2, Plus, CalendarDays } from "lucide-react";
type Gestao = { id: number; nome: string; valor: number; data: string; feito: string };

let nextId = 1;

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function getMonthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}
function groupByMonth(rows: Gestao[]) {
  const map = new Map<string, Gestao[]>();
  [...rows]
    .sort((a, b) => b.data.localeCompare(a.data))
    .forEach((row) => {
      const key = row.data.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });
  return map;
}

type EditingCell = { id: number; field: keyof Gestao } | null;

export default function GestoesPage() {
  const [rows, setRows] = useState<Gestao[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const allMonths = Array.from(new Set(rows.map((r) => r.data.slice(0, 7)))).sort((a, b) =>
    b.localeCompare(a)
  );

  const [activeMonth, setActiveMonth] = useState<string>(allMonths[0] ?? "");

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // All rows grouped (for sidebar totals)
  const allGrouped = groupByMonth(rows);

  // Filtered rows for the active month + search
  const filteredRows = rows.filter((r) => {
    const matchMonth = r.data.startsWith(activeMonth);
    const matchSearch =
      search === "" ||
      r.nome.toLowerCase().includes(search.toLowerCase()) ||
      r.feito.toLowerCase().includes(search.toLowerCase());
    return matchMonth && matchSearch;
  });

  function startEdit(id: number, field: keyof Gestao, val: string | number) {
    setEditing({ id, field });
    setEditValue(String(val));
  }

  function commitEdit() {
    if (!editing) return;
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== editing.id) return row;
        const updated = { ...row };
        if (editing.field === "valor") {
          const p = parseFloat(editValue.replace(",", "."));
          updated.valor = isNaN(p) ? row.valor : p;
        } else {
          (updated as Record<string, unknown>)[editing.field] = editValue;
        }
        return updated;
      })
    );
    setEditing(null);
  }

  function addRow() {
    const today = new Date().toISOString().slice(0, 10);
    const date = today.startsWith(activeMonth) ? today : `${activeMonth}-01`;
    const newRow: Gestao = { id: nextId++, nome: "", valor: 0, data: date, feito: "" };
    setRows((prev) => [...prev, newRow]);
    setTimeout(() => setEditing({ id: newRow.id, field: "nome" }), 50);
  }

  function deleteRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function Cell({
    row,
    field,
    display,
    inputType = "text",
    highlight = false,
  }: {
    row: Gestao;
    field: keyof Gestao;
    display: string;
    inputType?: string;
    highlight?: boolean;
  }) {
    const isEditing = editing?.id === row.id && editing?.field === field;
    return (
      <div
        className="px-4 py-3 cursor-pointer"
        onClick={() => !isEditing && startEdit(row.id, field, row[field])}
        title="Clique para editar"
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type={inputType}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(null);
            }}
            className="w-full px-2 py-1 rounded-lg text-sm outline-none"
            style={{
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-brand)",
              color: "var(--color-text)",
            }}
          />
        ) : (
          <span
            className="text-sm block truncate"
            style={
              highlight
                ? { color: "var(--color-brand)", fontWeight: 600 }
                : display
                ? { color: "var(--color-text)" }
                : { color: "var(--color-border)" }
            }
          >
            {display || "—"}
          </span>
        )}
      </div>
    );
  }

  const monthTotal = filteredRows.reduce((acc, r) => acc + r.valor, 0);

  return (
    <div className="flex flex-col h-full gap-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-3xl font-bold mb-1"
            style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
          >
            Gestões
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Clique em qualquer campo para editar · Enter confirma · Esc cancela
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <Upload size={15} />
          Importar planilha
        </button>
      </div>

      {/* ─── Body: sidebar + content ─── */}
      <div className="flex gap-5 flex-1 min-h-0">

        {/* Sidebar */}
        <div
          className="flex flex-col w-52 shrink-0 rounded-2xl overflow-hidden"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
        >
          <div
            className="px-4 py-3 flex items-center gap-2 border-b"
            style={{ borderColor: "var(--color-border)" }}
          >
            <CalendarDays size={14} style={{ color: "var(--color-brand)" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Meses
            </span>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {allMonths.map((ym) => {
              const monthRows = allGrouped.get(ym) ?? [];
              const total = monthRows.reduce((acc, r) => acc + r.valor, 0);
              const isActive = activeMonth === ym;
              const [y, m] = ym.split("-");
              const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
              const labelCap = label.charAt(0).toUpperCase() + label.slice(1);

              return (
                <button
                  key={ym}
                  onClick={() => setActiveMonth(ym)}
                  className="w-full text-left px-4 py-3 flex flex-col gap-0.5 transition-all active:scale-[0.97] relative"
                  style={
                    isActive
                      ? { background: "color-mix(in srgb, var(--color-brand) 12%, transparent)" }
                      : {}
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = "var(--color-surface-3)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "";
                  }}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full"
                      style={{ background: "var(--color-brand)" }}
                    />
                  )}
                  <span
                    className="text-sm font-semibold"
                    style={{ color: isActive ? "var(--color-brand)" : "var(--color-text)" }}
                  >
                    {labelCap}
                  </span>
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {y} · {monthRows.length} reg.
                  </span>
                  <span
                    className="text-xs font-semibold mt-0.5"
                    style={{ color: isActive ? "var(--color-brand)" : "var(--color-text-muted)" }}
                  >
                    {formatCurrency(total)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 gap-4">
          {/* Search + month heading */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
              <input
                type="text"
                placeholder="Buscar por nome ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm shrink-0"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              Total:
              <span className="font-semibold" style={{ color: "var(--color-brand)" }}>
                {formatCurrency(monthTotal)}
              </span>
            </div>
          </div>

          {/* Table */}
          <div
            className="flex-1 rounded-2xl overflow-hidden flex flex-col"
            style={{ border: "1px solid var(--color-border)" }}
          >
            {/* Month heading inside table */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b"
              style={{ background: "var(--color-surface-3)", borderColor: "var(--color-border)" }}
            >
              <span
                className="text-sm font-bold capitalize"
                style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
              >
                {getMonthLabel(activeMonth)}
              </span>
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {filteredRows.length} registro{filteredRows.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Column headers */}
            <div
              className="grid text-xs font-semibold uppercase tracking-wider px-2 py-2.5"
              style={{
                gridTemplateColumns: "2fr 1.2fr 1fr 3fr 36px",
                minWidth: "580px",
                background: "var(--color-surface-2)",
                color: "var(--color-text-muted)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <span className="px-4">Nome</span>
              <span className="px-4">Valor</span>
              <span className="px-4">Data</span>
              <span className="px-4">O que foi feito</span>
              <span />
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto" style={{ background: "var(--color-surface-2)" }}>
              {filteredRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <p className="text-2xl">🔍</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Nenhum registro encontrado</p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {search ? "Tente outro termo de busca." : "Adicione um registro abaixo."}
                  </p>
                </div>
              ) : (
                filteredRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="grid items-center px-2 group"
                    style={{
                      gridTemplateColumns: "2fr 1.2fr 1fr 3fr 36px",
                      minWidth: "580px",
                      background: index % 2 === 0 ? "var(--color-surface-2)" : "var(--color-surface)",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    <Cell row={row} field="nome" display={row.nome} />
                    <Cell row={row} field="valor" display={formatCurrency(row.valor)} inputType="number" highlight />
                    <Cell row={row} field="data" display={formatDate(row.data)} inputType="date" />
                    <Cell row={row} field="feito" display={row.feito} />
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="flex items-center justify-center w-7 h-7 rounded-lg transition-all opacity-0 group-hover:opacity-60 hover:opacity-100! active:scale-90"
                      style={{ color: "#f87171" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add row */}
            <button
              onClick={addRow}
              className="flex items-center gap-2 px-6 py-3 text-sm transition-all active:scale-[0.99] w-full"
              style={{
                background: "var(--color-surface-2)",
                color: "var(--color-text-muted)",
                borderTop: "1px dashed var(--color-border)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--color-brand)";
                e.currentTarget.style.background = "var(--color-surface-3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--color-text-muted)";
                e.currentTarget.style.background = "var(--color-surface-2)";
              }}
            >
              <Plus size={14} />
              Adicionar registro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
