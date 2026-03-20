import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const mockAuth = cookieStore.get("mock-auth")?.value;

  let role: string | undefined;
  let userName: string | undefined;
  let userEmail: string | undefined;
  let avatarUrl: string | undefined;
  let isMock = false;

  if (mockAuth === "user" || mockAuth === "admin") {
    isMock = true;
    role = mockAuth;
    userName = mockAuth === "admin" ? "Admin Demo" : "Usuário Demo";
    userEmail = mockAuth === "admin" ? "admin@demo.com" : "demo@meuprojeto.com";
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    role = profile?.role;
    userName = profile?.full_name;
    userEmail = user.email;
    avatarUrl = profile?.avatar_url;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={role}
        userName={userName}
        userEmail={userEmail}
        avatarUrl={avatarUrl}
        isMock={isMock}
      />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 pt-16 pb-8 lg:px-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
