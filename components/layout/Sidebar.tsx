"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  ClipboardList,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  Zap,
  Menu,
  X,
  FolderOpen,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard",                  label: "Dashboard",     icon: <LayoutDashboard size={18} /> },
  { href: "/dashboard/gestoes",          label: "Gestões",       icon: <ClipboardList size={18} /> },
  { href: "/dashboard/cobrancas",        label: "Cobranças",     icon: <CreditCard size={18} /> },
  { href: "/dashboard/arquivos",         label: "Arquivos",      icon: <FolderOpen size={18} /> },
  { href: "/dashboard/configuracoes",    label: "Configurações", icon: <Settings size={18} /> },
  { href: "/admin", label: "Admin", icon: <Shield size={18} />, adminOnly: true },
];

interface SidebarProps {
  role?: string;
  userName?: string;
  userEmail?: string;
  isMock?: boolean;
}

export default function Sidebar({ role, userName, userEmail, isMock }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    if (isMock) {
      document.cookie = "mock-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
      router.push("/login");
      router.refresh();
      return;
    }
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const visibleItems = navItems.filter((item) => !item.adminOnly || role === "admin");

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--color-brand)" }}
        >
          <Zap size={16} className="text-white" />
        </div>
        <span
          className="font-bold text-base"
          style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
        >
          MeuProjeto
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {visibleItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? "var(--color-surface-3)" : "transparent",
                color: active ? "var(--color-text)" : "var(--color-text-muted)",
                borderLeft: active ? "2px solid var(--color-brand)" : "2px solid transparent",
              }}
            >
              <span style={{ color: active ? "var(--color-brand)" : "inherit" }}>
                {item.icon}
              </span>
              {item.label}
              {item.adminOnly && (
                <span
                  className="ml-auto text-xs px-1.5 py-0.5 rounded"
                  style={{ background: "var(--color-brand)", color: "white", fontSize: "10px" }}
                >
                  ADMIN
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div
        className="mx-3 mb-4 p-3 rounded-xl"
        style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: "var(--color-brand)", color: "white" }}
          >
            {(userName || userEmail || "U")[0].toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
              {userName || "Usuário"}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
              {userEmail}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
          style={{ color: "var(--color-text-muted)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--color-surface-2)";
            e.currentTarget.style.color = "#f87171";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--color-text-muted)";
          }}
        >
          <LogOut size={15} />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-full z-40 w-64 flex flex-col transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "var(--color-surface-2)",
          borderRight: "1px solid var(--color-border)",
        }}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-60 h-screen sticky top-0 flex-shrink-0"
        style={{
          background: "var(--color-surface-2)",
          borderRight: "1px solid var(--color-border)",
        }}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
