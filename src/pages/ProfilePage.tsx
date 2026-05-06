import { useAuth } from '@/contexts/AuthContext'
import { Camera, Mail, Shield } from 'lucide-react'

export default function ProfilePage() {
  const { userName, userEmail, role, avatarUrl } = useAuth()
  const initials = (userName || userEmail || 'U')[0].toUpperCase()

  return (
    <div className="max-w-lg flex flex-col gap-8">

      {/* Header */}
      <div className="animate-fade-in">
        <p className="text-xs font-bold tracking-[0.18em] uppercase mb-1" style={{ color: 'var(--color-brand)' }}>Conta</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
          Perfil
        </h1>
      </div>

      {/* Card do usuário */}
      <div className="rounded-2xl overflow-hidden animate-fade-in" style={{ border: '1px solid var(--color-border)', animationDelay: '60ms' }}>
        {/* Faixa de capa */}
        <div className="h-24 relative"
          style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-brand) 20%, var(--color-surface-3)), var(--color-surface-3))' }}>
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, var(--color-brand) 0, var(--color-brand) 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
        </div>

        {/* Avatar + info */}
        <div className="px-6 pb-6" style={{ background: 'var(--color-surface-2)' }}>
          <div className="-mt-8 mb-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-xl font-bold border-2"
              style={{ background: 'var(--color-brand)', color: 'white', borderColor: 'var(--color-surface-2)', boxShadow: '0 0 20px color-mix(in srgb, var(--color-brand) 30%, transparent)' }}>
              {avatarUrl
                ? <img src={avatarUrl.startsWith('data:') ? avatarUrl : `data:image/jpeg;base64,${avatarUrl}`} alt="" className="w-full h-full object-cover" />
                : initials}
            </div>
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-text)', marginBottom: 4 }}>
            {userName || 'Usuário'}
          </h2>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Mail size={13} style={{ color: 'var(--color-text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{userEmail}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={13} style={{ color: 'var(--color-text-muted)' }} />
              <span className="text-xs px-2 py-0.5 rounded-full font-bold capitalize"
                style={{ background: role === 'admin' ? 'color-mix(in srgb, var(--color-brand) 15%, transparent)' : 'var(--color-surface-3)', color: role === 'admin' ? 'var(--color-brand)' : 'var(--color-text-muted)', border: `1px solid ${role === 'admin' ? 'color-mix(in srgb, var(--color-brand) 30%, transparent)' : 'var(--color-border)'}` }}>
                {role ?? 'usuário'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Em desenvolvimento */}
      <div className="flex flex-col items-center justify-center py-12 rounded-2xl gap-4 animate-fade-in"
        style={{ border: '1px dashed var(--color-border)', background: 'var(--color-surface-2)', animationDelay: '100ms' }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: 'color-mix(in srgb, var(--color-brand) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-brand) 25%, transparent)' }}>
          <Camera size={22} style={{ color: 'var(--color-brand)' }} />
        </div>
        <div className="text-center">
          <p className="font-bold text-sm mb-1" style={{ color: 'var(--color-text)' }}>Edição de perfil em breve</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Foto, nome e outras configurações de conta.
          </p>
        </div>
      </div>
    </div>
  )
}
