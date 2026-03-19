"use client";

import { useState, useRef, useEffect } from "react";
import { Clock, Calendar, Save, CheckCircle, Zap, MessageSquare, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DIAS_RAPIDOS = [1, 5, 10, 15, 20, 25, 28];
const HORAS_RAPIDAS = ["07:00", "08:00", "09:00", "10:00", "14:00", "18:00"];
const MSG_PADRAO = "Olá {nome}! Sua cobrança de {valor} vence no dia {dia}. Por favor, realize o pagamento em dia!";

export default function ConfiguracoesPage() {
  const supabase = createClient();

  const [ativo, setAtivo] = useState(false);
  const [diaMes, setDiaMes] = useState(5);
  const [horario, setHorario] = useState("08:00");
  const [mensagem, setMensagem] = useState(MSG_PADRAO);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Carrega config salva ao montar
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("configuracoes")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setAtivo(data.ativo);
        setDiaMes(data.dia_mes);
        setHorario(data.horario.slice(0, 5)); // "HH:MM:SS" → "HH:MM"
        setMensagem(data.mensagem);
      }
      setLoading(false);
    }
    load();
  }, []);

  function inserirVariavel(variavel: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const novo = mensagem.slice(0, start) + variavel + mensagem.slice(end);
    setMensagem(novo);
    setSaved(false);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + variavel.length, start + variavel.length); }, 0);
  }

  async function salvar() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("configuracoes").upsert({
        user_id: user.id,
        ativo,
        dia_mes: diaMes,
        horario,
        mensagem,
      }, { onConflict: "user_id" });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const previa = mensagem
    .replace(/\{nome\}/g, "João Silva")
    .replace(/\{valor\}/g, "R$ 1.500,00")
    .replace(/\{dia\}/g, String(diaMes));

  const diaCustom = !DIAS_RAPIDOS.includes(diaMes);
  const horaCustom = !HORAS_RAPIDAS.includes(horario);

  return (
    <div className="max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Configurações
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Defina quando e como as cobranças automáticas serão enviadas
          </p>
        </div>
        <button
          onClick={salvar}
          disabled={saving || loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] shrink-0"
          style={saved
            ? { background: "#4ade8020", color: "#4ade80", border: "1px solid #4ade8040" }
            : saving || loading
            ? { background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }
            : { background: "var(--color-brand)", color: "white" }}
        >
          {saved ? <CheckCircle size={15} /> : saving || loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saved ? "Salvo!" : saving ? "Salvando..." : loading ? "Carregando..." : "Salvar"}
        </button>
      </div>

      <div className="space-y-3">

        {/* ── Toggle automação ── */}
        <div
          className="flex items-center justify-between p-5 rounded-2xl cursor-pointer transition-all"
          style={{
            background: ativo ? "#4ade8008" : "var(--color-surface-2)",
            border: `1px solid ${ativo ? "#4ade8050" : "var(--color-border)"}`,
          }}
          onClick={() => { setAtivo((v) => !v); setSaved(false); }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: ativo ? "#4ade8020" : "var(--color-surface-3)" }}
            >
              <Zap size={18} style={{ color: ativo ? "#4ade80" : "var(--color-text-muted)" }} />
            </div>
            <div>
              <p className="font-semibold text-sm">Cobrança automática</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {ativo
                  ? `Ativa — disparo todo dia ${diaMes} às ${horario}`
                  : "Inativa — cobranças só serão enviadas manualmente"}
              </p>
            </div>
          </div>
          <div
            className="w-12 h-6 rounded-full relative transition-all shrink-0"
            style={{ background: ativo ? "#4ade80" : "var(--color-surface-3)", border: `1px solid ${ativo ? "#4ade80" : "var(--color-border)"}` }}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              style={{ left: ativo ? "26px" : "2px" }}
            />
          </div>
        </div>

        {/* ── Quando enviar ── */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          {/* Título */}
          <div className="px-5 py-4 flex items-center gap-3" style={{ background: "var(--color-surface-3)", borderBottom: "1px solid var(--color-border)" }}>
            <Calendar size={15} style={{ color: "var(--color-brand)" }} />
            <p className="font-semibold text-sm">Quando enviar</p>
          </div>

          <div className="divide-y" style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}>

            {/* Dia */}
            <div className="p-5">
              <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--color-text-muted)" }}>
                <Calendar size={12} /> Dia do mês
              </p>
              <div className="grid grid-cols-7 gap-2">
                {DIAS_RAPIDOS.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setDiaMes(d); setSaved(false); }}
                    className="h-10 rounded-xl text-sm font-bold transition-all"
                    style={diaMes === d && !diaCustom
                      ? { background: "var(--color-brand)", color: "white" }
                      : { background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                  >
                    {d}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={28}
                  placeholder="?"
                  value={diaMes}
                  onChange={(e) => { setDiaMes(Math.min(28, Math.max(1, Number(e.target.value)))); setSaved(false); }}
                  className="h-10 rounded-xl text-sm text-center font-bold outline-none"
                  style={{
                    background: diaCustom ? "color-mix(in srgb, var(--color-brand) 15%, transparent)" : "var(--color-surface-3)",
                    border: `1px solid ${diaCustom ? "var(--color-brand)" : "var(--color-border)"}`,
                    color: diaCustom ? "var(--color-brand)" : "var(--color-text-muted)",
                  }}
                />
              </div>
              <p className="text-xs mt-3" style={{ color: "var(--color-text-muted)" }}>
                Envio todo dia <strong style={{ color: "var(--color-text)" }}>{diaMes}</strong> de cada mês
              </p>
            </div>

            {/* Horário */}
            <div className="p-5">
              <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--color-text-muted)" }}>
                <Clock size={12} /> Horário de envio
              </p>
              <div className="grid grid-cols-4 gap-2">
                {HORAS_RAPIDAS.map((h) => (
                  <button
                    key={h}
                    onClick={() => { setHorario(h); setSaved(false); }}
                    className="h-10 rounded-xl text-sm font-bold transition-all"
                    style={horario === h && !horaCustom
                      ? { background: "var(--color-brand)", color: "white" }
                      : { background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                  >
                    {h}
                  </button>
                ))}
                <input
                  type="time"
                  value={horario}
                  onChange={(e) => { setHorario(e.target.value); setSaved(false); }}
                  className="col-span-2 h-10 px-3 rounded-xl text-sm font-bold outline-none"
                  style={{
                    background: horaCustom ? "color-mix(in srgb, var(--color-brand) 15%, transparent)" : "var(--color-surface-3)",
                    border: `1px solid ${horaCustom ? "var(--color-brand)" : "var(--color-border)"}`,
                    color: horaCustom ? "var(--color-brand)" : "var(--color-text-muted)",
                  }}
                />
              </div>
              <p className="text-xs mt-3" style={{ color: "var(--color-text-muted)" }}>
                Mensagens enviadas às <strong style={{ color: "var(--color-text)" }}>{horario}</strong>
              </p>
            </div>

          </div>
        </div>

        {/* ── Mensagem ── */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          <div className="px-5 py-4 flex items-center gap-3" style={{ background: "var(--color-surface-3)", borderBottom: "1px solid var(--color-border)" }}>
            <MessageSquare size={15} style={{ color: "var(--color-brand)" }} />
            <p className="font-semibold text-sm">Mensagem</p>
          </div>

          <div className="p-5" style={{ background: "var(--color-surface-2)" }}>
            {/* Chips de variável */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Arraste ou clique para inserir:
              </span>
              {["{nome}", "{valor}", "{dia}"].map((v) => (
                <button
                  key={v}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", v)}
                  onClick={() => inserirVariavel(v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105 cursor-grab active:cursor-grabbing select-none"
                  style={{ background: "color-mix(in srgb, var(--color-brand) 15%, transparent)", color: "var(--color-brand)", border: "1px solid color-mix(in srgb, var(--color-brand) 40%, transparent)" }}
                >
                  ⠿ {v}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={4}
              value={mensagem}
              onChange={(e) => { setMensagem(e.target.value); setSaved(false); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const v = e.dataTransfer.getData("text/plain");
                const el = textareaRef.current;
                if (!el || !v) return;
                const pos = el.selectionStart;
                const novo = mensagem.slice(0, pos) + v + mensagem.slice(pos);
                setMensagem(novo);
                setSaved(false);
                setTimeout(() => { el.focus(); el.setSelectionRange(pos + v.length, pos + v.length); }, 0);
              }}
              className="w-full px-3 py-3 rounded-xl text-sm outline-none resize-none leading-relaxed"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />

            {/* Prévia */}
            <div className="mt-3">
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>Prévia</p>
              <div
                className="px-4 py-3 rounded-xl text-sm leading-relaxed relative"
                style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                <span
                  className="absolute -top-2 left-4 text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "var(--color-surface-3)", color: "var(--color-brand)", border: "1px solid var(--color-border)" }}
                >
                  João Silva
                </span>
                {previa}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
