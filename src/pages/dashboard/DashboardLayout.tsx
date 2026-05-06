import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-surface)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-10 lg:px-10 lg:pt-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
