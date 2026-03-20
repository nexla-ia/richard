import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const senha: string | null = body.senha ?? null;
  const currentPastaId: number | null = body.current_pasta_id ?? null;

  // Busca o compartilhamento pelo token
  const { data: share, error } = await admin
    .from("compartilhamentos")
    .select("id, nome, storage_path, senha, ativo, pasta_id, user_id, expires_at, max_downloads, download_count")
    .eq("id", token)
    .eq("ativo", true)
    .single();

  if (error || !share) {
    return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 404 });
  }

  // Verifica validade
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: "Este link expirou." }, { status: 410 });
  }

  // Verifica limite de acessos (só conta acesso inicial, não navegação entre subpastas)
  const isInitialAccess = currentPastaId === null;
  if (share.max_downloads !== null && isInitialAccess) {
    if (share.download_count >= share.max_downloads) {
      return NextResponse.json({ error: "Limite de acessos atingido." }, { status: 403 });
    }
  }

  // Verifica senha
  if (share.senha) {
    if (!senha) {
      return NextResponse.json({ passwordRequired: true }, { status: 401 });
    }
    if (senha !== share.senha) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }
  }

  // Incrementa contador no acesso inicial
  if (isInitialAccess) {
    await admin
      .from("compartilhamentos")
      .update({ download_count: (share.download_count ?? 0) + 1 })
      .eq("id", token);
  }

  // Pasta atual: se não informada, usa a raiz do compartilhamento
  const activePastaId = currentPastaId ?? share.pasta_id;
  const activeStoragePath = `${share.user_id}/${activePastaId}`;

  // Busca subpastas no banco
  const { data: pastasData } = await admin
    .from("pastas")
    .select("id, nome")
    .eq("parent_id", activePastaId)
    .eq("user_id", share.user_id)
    .order("nome");

  // Busca fotos no Storage
  const { data: files } = await admin.storage
    .from("fotos")
    .list(activeStoragePath, { limit: 500, sortBy: { column: "name", order: "asc" } });

  const fotos = (files ?? [])
    .filter((f) => f.id !== null)
    .map((f) => {
      const { data: urlData } = admin.storage
        .from("fotos")
        .getPublicUrl(`${activeStoragePath}/${f.name}`);
      return { name: f.name, url: urlData.publicUrl, size: f.metadata?.size as number | undefined };
    });

  // Nome da pasta atual
  let nomePastaAtual = share.nome;
  if (currentPastaId && currentPastaId !== share.pasta_id) {
    const { data: pastaInfo } = await admin
      .from("pastas")
      .select("nome")
      .eq("id", currentPastaId)
      .single();
    if (pastaInfo) nomePastaAtual = pastaInfo.nome;
  }

  return NextResponse.json({
    nome: share.nome,
    nomeAtual: nomePastaAtual,
    rootPastaId: share.pasta_id,
    pastas: pastasData ?? [],
    fotos,
    // Metadados públicos para exibição
    expiresAt: share.expires_at ?? null,
    maxDownloads: share.max_downloads ?? null,
    downloadCount: (share.download_count ?? 0) + (isInitialAccess ? 1 : 0),
  });
}
