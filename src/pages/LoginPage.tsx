import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ArrowRight, Camera } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const supabase = createClient()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado'
      setError(msg === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-surface)' }}>

      {/* ── Painel esquerdo ── */}
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden"
        style={{ background: 'var(--color-surface-3)', borderRight: '1px solid var(--color-border)' }}>

        {/* Grade decorativa sutil */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            opacity: 0.35,
          }} />

        {/* Glow brand suave */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'var(--color-brand)', filter: 'blur(140px)', opacity: 0.18 }} />
        <div className="absolute -bottom-32 right-0 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'var(--color-brand)', filter: 'blur(120px)', opacity: 0.12 }} />

        {/* Logo */}
        <div className="relative z-10 px-14 pt-12 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-brand)', boxShadow: '0 8px 20px -6px color-mix(in srgb, var(--color-brand) 60%, transparent)' }}>
            <Camera size={17} className="text-white" />
          </div>
          <div>
            <p className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-text-muted)' }}>Studio</p>
            <p className="text-base font-bold leading-none" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)', letterSpacing: '-0.01em' }}>Charme</p>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10 px-14 mt-auto pb-20">
          <p className="text-xs font-bold tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--color-brand)' }}>
            Plataforma ativa
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.6rem, 3.8vw, 3.6rem)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: 'var(--color-text)',
          }}>
            Bem-vindo
            <br />
            de <span style={{ color: 'var(--color-brand)' }}>volta.</span>
          </h1>
          <p className="mt-5 text-sm leading-relaxed max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
            Gerencie ensaios, cobranças e clientes com total controle — tudo em um só lugar.
          </p>

          {/* Features */}
          <div className="mt-10 space-y-3">
            {[
              'Galeria de ensaios fotográficos',
              'Controle financeiro e cobranças',
              'Mensagens automáticas via WhatsApp',
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-brand)' }} />
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Painel direito (form) ── */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: 'var(--color-surface-2)' }}>
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-brand)' }}>
              <Camera size={15} className="text-white" />
            </div>
            <span className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>Studio Charme</span>
          </div>

          <div className="mb-8">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', marginBottom: 6 }}>
              Entrar
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Insira suas credenciais para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold mb-2 uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-brand) 12%, transparent)' }}
                onBlur={(e)  => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {/* Senha */}
            <div>
              <label className="block text-xs font-bold mb-2 uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-brand)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-brand) 12%, transparent)' }}
                  onBlur={(e)  => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity opacity-50 hover:opacity-100"
                  style={{ color: 'var(--color-text-muted)' }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }}>
                <span>⚠</span> {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 group mt-2"
              style={{
                background: loading ? 'var(--color-surface-3)' : 'var(--color-brand)',
                color: loading ? 'var(--color-text-muted)' : 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 8px 20px -6px color-mix(in srgb, var(--color-brand) 50%, transparent)',
                letterSpacing: '0.02em',
              }}
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Aguarde...</>
                : <>Entrar <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" /></>
              }
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Plataforma segura · Dados criptografados
          </p>
        </div>
      </div>
    </div>
  )
}
