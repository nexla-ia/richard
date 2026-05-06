import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface AuthContextType {
  user: User | null
  role: string | null
  userName: string | null
  userEmail: string | null
  avatarUrl: string | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null, role: null, userName: null, userEmail: null, avatarUrl: null, loading: true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [user, setUser]           = useState<User | null>(null)
  const [role, setRole]           = useState<string | null>(null)
  const [userName, setUserName]   = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)

  async function loadProfile(uid: string) {
    try {
      const { data } = await (supabase as any)
        .from('profiles')
        .select('role, full_name, avatar_url')
        .eq('id', uid)
        .single()
      if (data) {
        setRole(data.role ?? null)
        setUserName(data.full_name ?? null)
        setAvatarUrl(data.avatar_url ?? null)
      }
    } catch { /* sem perfil */ }
  }

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 6000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        clearTimeout(timeout)
        const u = session?.user ?? null
        setUser(u)
        setUserEmail(u?.email ?? null)
        setLoading(false) // libera imediatamente
        if (u) loadProfile(u.id) // perfil em background
        else { setRole(null); setUserName(null); setAvatarUrl(null) }
      }
    )

    // Fallback caso onAuthStateChange não dispare
    supabase.auth.getSession()
      .catch(() => { clearTimeout(timeout); setLoading(false) })

    return () => { clearTimeout(timeout); subscription.unsubscribe() }
  }, [])

  return (
    <AuthContext.Provider value={{ user, role, userName, userEmail, avatarUrl, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
