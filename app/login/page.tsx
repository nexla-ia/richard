"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Loader2,
  Camera,
  CheckCircle2,
  ArrowRight,
  ImageIcon,
  CalendarCheck,
  Star,
} from "lucide-react";

const FEATURES = [
  {
    icon: ImageIcon,
    title: "Galeria de ensaios",
    desc: "Acesse e gerencie todos os seus ensaios fotográficos em um só lugar.",
  },
  {
    icon: CalendarCheck,
    title: "Agendamentos organizados",
    desc: "Controle sua agenda de sessões de forma simples e eficiente.",
  },
  {
    icon: Star,
    title: "Experiência premium",
    desc: "Uma plataforma pensada para profissionais da fotografia.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      setError(msg === "Invalid login credentials" ? "E-mail ou senha incorretos." : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-surface)" }}>
      {/* ─── Left panel ─── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[52%] p-14 relative overflow-hidden"
        style={{ background: "var(--color-surface-2)" }}
      >
        {/* Grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(var(--color-border) 1px, transparent 1px),
              linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
            opacity: 0.06,
          }}
        />

        {/* Radial glow — top-left */}
        <div
          className="absolute -top-32 -left-32 w-120 h-120 rounded-full blur-[120px]"
          style={{ background: "var(--color-brand)", opacity: 0.18 }}
        />
        {/* Radial glow — bottom-right */}
        <div
          className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full blur-[100px]"
          style={{ background: "var(--color-brand)", opacity: 0.10 }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <BrandLogo size="md" />
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: "color-mix(in srgb, var(--color-brand) 15%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-brand) 35%, transparent)",
              color: "var(--color-brand)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Plataforma ativa
          </div>

          <h1
            className="text-5xl font-extrabold leading-[1.1] tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
          >
            Bem-vindo de
            <br />
            <span style={{ color: "var(--color-brand)" }}>volta.</span>
          </h1>

          <p className="text-base leading-relaxed max-w-sm" style={{ color: "var(--color-text-muted)" }}>
            Acesse sua conta e gerencie seus ensaios, agendamentos e clientes — tudo em um só lugar.
          </p>

          {/* Feature list */}
          <div className="space-y-4 pt-2">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div
                  className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
                  style={{
                    background: "color-mix(in srgb, var(--color-brand) 12%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-brand) 25%, transparent)",
                  }}
                >
                  <Icon size={16} style={{ color: "var(--color-brand)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--color-text)" }}>
                    {title}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-2">
          <CheckCircle2 size={14} style={{ color: "var(--color-brand)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Seus dados estão protegidos com criptografia AES-256
          </span>
        </div>
      </div>

      {/* ─── Right panel ─── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-100">

          {/* Mobile logo */}
          <div className="mb-10 lg:hidden">
            <BrandLogo size="sm" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2
              className="text-3xl font-extrabold mb-2 tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
            >
              Entrar na conta
            </h2>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Insira suas credenciais para continuar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="E-mail">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao@email.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
              />
            </Field>

            <Field
              label="Senha"
              labelRight={
                <button
                  type="button"
                  className="text-xs font-medium hover:underline transition-all"
                  style={{ color: "var(--color-brand)" }}
                >
                  Esqueceu a senha?
                </button>
              }
            >
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-100 opacity-60"
                  style={{ color: "var(--color-text-muted)" }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => setRememberMe(!rememberMe)}
                className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                style={{
                  background: rememberMe ? "var(--color-brand)" : "var(--color-surface-2)",
                  border: `1px solid ${rememberMe ? "var(--color-brand)" : "var(--color-border)"}`,
                }}
              >
                {rememberMe && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Lembrar de mim
              </span>
            </label>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ background: "#2d1b1b", border: "1px solid #5c2626", color: "#f87171" }}
              >
                <span className="mt-0.5 text-base leading-none">⚠</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
              style={{
                background: loading ? "var(--color-surface-3)" : "var(--color-brand)",
                color: loading ? "var(--color-text-muted)" : "white",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 24px color-mix(in srgb, var(--color-brand) 40%, transparent)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Aguarde...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Demo divider */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
              <span className="text-xs font-medium px-2" style={{ color: "var(--color-text-muted)" }}>
                ou acesse como demo
              </span>
              <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
            </div>
            <button
              type="button"
              onClick={() => {
                document.cookie = "mock-auth=user; path=/; max-age=86400";
                router.push("/dashboard");
                router.refresh();
              }}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              Entrar como Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Brand logo ─── */

function BrandLogo({ size }: { size: "sm" | "md" }) {
  const iconSize = size === "md" ? 20 : 18;
  const boxSize = size === "md" ? "w-11 h-11" : "w-9 h-9";

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${boxSize} rounded-xl flex items-center justify-center shadow-lg shrink-0`}
        style={{ background: "var(--color-brand)" }}
      >
        <Camera size={iconSize} className="text-white" />
      </div>
      <div className="leading-none">
        <p
          className="text-[10px] font-semibold tracking-[0.18em] uppercase mb-0.5"
          style={{ color: "var(--color-text-muted)" }}
        >
          Studio Foto
        </p>
        <p
          className="text-xl font-extrabold tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--color-text)", letterSpacing: "-0.01em" }}
        >
          Charme
        </p>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
};

function Field({
  label,
  labelRight,
  children,
}: {
  label: string;
  labelRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </label>
        {labelRight}
      </div>
      {children}
    </div>
  );
}
