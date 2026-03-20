"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Folder,
  FolderOpen,
  Plus,
  Upload,
  Home,
  ChevronRight,
  X,
  Trash2,
  Loader2,
  ArrowUp,
  Share2,
  Lock,
  Link,
  Copy,
  Check,
  Trash,
  Pencil,
  AlignJustify,
  LayoutList,
  LayoutGrid,
  Calendar,
  Clock,
} from "lucide-react";

type ViewSize = "small" | "medium" | "large";

const VIEW_CFG = {
  small:  { py: 5,  iconSize: 14, thumbSize: 24, fontSize: "text-xs"  },
  medium: { py: 9,  iconSize: 18, thumbSize: 34, fontSize: "text-sm"  },
  large:  { py: 0,  iconSize: 56, thumbSize: 120, fontSize: "text-xs" },
} satisfies Record<ViewSize, { py: number; iconSize: number; thumbSize: number; fontSize: string }>;

type Pasta = {
  id: number;
  nome: string;
  created_at: string;
  updated_at: string;
};

type Foto = {
  name: string;
  url: string;
  updatedAt?: string;
  size?: number;
  mime?: string;
};

type Crumb = { id: number | null; nome: string };

type ShareData = {
  id: string;
  senha: string | null;
  expires_at: string | null;
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatSize(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


export default function ArquivosPage() {
  const supabase = createClient();

  const [userId, setUserId]           = useState<string | null>(null);
  const [currentId, setCurrentId]     = useState<number | null>(null); // null = raiz
  const [breadcrumb, setBreadcrumb]   = useState<Crumb[]>([{ id: null, nome: "Início" }]);
  const [pastas, setPastas]           = useState<Pasta[]>([]);
  const [fotos, setFotos]             = useState<Foto[]>([]);
  const [loading, setLoading]         = useState(true);
  const [uploading, setUploading]     = useState(false);
  const [dragOver, setDragOver]       = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [folderName, setFolderName]   = useState("");
  const [creating, setCreating]       = useState(false);
  const [selected, setSelected]       = useState<string | null>(null);
  const [preview, setPreview]         = useState<{ url: string; name: string } | null>(null);
  const [draggingFoto, setDraggingFoto] = useState<Foto | null>(null);
  const [dropTarget, setDropTarget]   = useState<number | "parent" | null>(null); // pastaId ou "parent"
  const [moving, setMoving]           = useState(false);

  // ── Compartilhar ──
  const [showShare, setShowShare]           = useState(false);
  const [sharePasta, setSharePasta]         = useState<Pasta | null>(null);
  const [shareSenha, setShareSenha]         = useState("");
  const [shareLink, setShareLink]           = useState<string | null>(null);
  const [shareId, setShareId]               = useState<string | null>(null);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [copied, setCopied]                 = useState(false);
  const [shareExpiry, setShareExpiry]       = useState("");       // "YYYY-MM-DD"
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareEditing, setShareEditing] = useState(false);
  const [sharedPastaIds, setSharedPastaIds] = useState<Set<number>>(new Set());
  const [sharedPastaData, setSharedPastaData] = useState<Map<number, ShareData>>(new Map());

  // ── Tamanho de visualização ──
  const [viewSize, setViewSize] = useState<ViewSize>("medium");

  // ── Renomear ──
  type RenamingState = { kind: "pasta"; id: number } | { kind: "foto"; name: string } | null;
  const [renaming, setRenaming]       = useState<RenamingState>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef                = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (userId) loadItems();
    setSelected(null);
  }, [userId, currentId]);

  // Storage path: raiz = userId, pasta = userId/pastaId
  function storagePath(extra?: string) {
    const base = currentId !== null ? `${userId}/${currentId}` : `${userId}`;
    return extra ? `${base}/${extra}` : base;
  }

  async function loadItems() {
    if (!userId) return;
    setLoading(true);

    // 1. Busca subpastas do banco
    const query = supabase
      .from("pastas")
      .select("id, nome, created_at, updated_at")
      .eq("user_id", userId)
      .order("nome");

    if (currentId === null) {
      query.is("parent_id", null);
    } else {
      query.eq("parent_id", currentId);
    }

    const { data: pastasData } = await query;
    const pastasList = (pastasData as Pasta[]) ?? [];
    setPastas(pastasList);

    // Busca quais pastas têm compartilhamento ativo
    if (pastasList.length > 0) {
      const { data: shares } = await supabase
        .from("compartilhamentos")
        .select("id, pasta_id, senha, expires_at")
        .in("pasta_id", pastasList.map((p) => p.id))
        .eq("ativo", true);
      const newMap = new Map<number, ShareData>();
      (shares ?? []).forEach((s: ShareData & { pasta_id: number }) => {
        newMap.set(s.pasta_id, { id: s.id, senha: s.senha, expires_at: s.expires_at });
      });
      setSharedPastaData(newMap);
      setSharedPastaIds(new Set(newMap.keys()));
    } else {
      setSharedPastaData(new Map());
      setSharedPastaIds(new Set());
    }

    // 2. Busca fotos do Storage nesta pasta
    const { data: storageData } = await supabase.storage
      .from("fotos")
      .list(storagePath(), { sortBy: { column: "name", order: "asc" } });

    const mappedFotos: Foto[] = [];
    for (const item of storageData ?? []) {
      if (item.id === null) continue; // ignora "subpastas" antigas do storage
      const { data: urlData } = supabase.storage
        .from("fotos")
        .getPublicUrl(storagePath(item.name));
      mappedFotos.push({
        name: item.name,
        url: urlData.publicUrl,
        updatedAt: item.updated_at ?? item.created_at ?? undefined,
        size: item.metadata?.size,
        mime: item.metadata?.mimetype,
      });
    }
    setFotos(mappedFotos);
    setLoading(false);
  }

  async function handleCreateFolder() {
    if (!folderName.trim() || !userId) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("pastas")
      .insert({ user_id: userId, nome: folderName.trim(), parent_id: currentId })
      .select()
      .single();
    if (!error && data) {
      setFolderName("");
      setShowModal(false);
      loadItems();
    }
    setCreating(false);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || !userId) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      await supabase.storage
        .from("fotos")
        .upload(storagePath(file.name), file, { upsert: true });
    }
    setUploading(false);
    loadItems();
  }

  async function deleteFolder(pasta: Pasta) {
    // Remove arquivos do Storage desta pasta
    const sp = `${userId}/${pasta.id}`;
    const { data: files } = await supabase.storage.from("fotos").list(sp, { limit: 1000 });
    if (files && files.length > 0) {
      await supabase.storage.from("fotos").remove(files.map((f) => `${sp}/${f.name}`));
    }
    // Remove do banco (cascade apaga subpastas)
    await supabase.from("pastas").delete().eq("id", pasta.id);
    if (selected === `pasta-${pasta.id}`) setSelected(null);
    loadItems();
  }

  async function deleteFoto(foto: Foto) {
    await supabase.storage.from("fotos").remove([storagePath(foto.name)]);
    if (selected === `foto-${foto.name}`) setSelected(null);
    loadItems();
  }

  // ── Funções de compartilhamento ──
  async function openShare(pasta: Pasta) {
    setSharePasta(pasta);
    setShareSenha("");
    setShareExpiry("");
    setShareLink(null);
    setShareId(null);
    setShareError(null);
    setShareEditing(false);
    setSharingLoading(true);
    setShowShare(true);
    // verifica se já existe share ativo para esta pasta
    const { data } = await supabase
      .from("compartilhamentos")
      .select("id, senha, expires_at")
      .eq("pasta_id", pasta.id)
      .eq("ativo", true)
      .maybeSingle();
    if (data) {
      setShareId(data.id);
      setShareLink(`${window.location.origin}/s/${data.id}`);
      setShareSenha(data.senha ?? "");
      setShareExpiry(data.expires_at ? data.expires_at.split("T")[0] : "");
    }
    setSharingLoading(false);
  }

  async function handleCreateShare() {
    if (!userId || !sharePasta) return;
    setSharingLoading(true);
    setShareError(null);
    // As fotos da pasta ficam em userId/pastaId no Storage
    const sp = `${userId}/${sharePasta.id}`;
    const { data, error } = await supabase
      .from("compartilhamentos")
      .insert({
        user_id: userId,
        pasta_id: sharePasta.id,
        storage_path: sp,
        nome: sharePasta.nome,
        senha: shareSenha.trim() || null,
        expires_at: shareExpiry ? new Date(shareExpiry + "T23:59:59").toISOString() : null,
        ativo: true,
      })
      .select("id")
      .single();
    if (error) {
      setShareError(error.message);
    } else if (data) {
      setShareId(data.id);
      setShareLink(`${window.location.origin}/s/${data.id}`);
      if (sharePasta) {
        const info: ShareData = { id: data.id, senha: shareSenha.trim() || null, expires_at: shareExpiry ? new Date(shareExpiry + "T23:59:59").toISOString() : null };
        setSharedPastaData((prev) => new Map(prev).set(sharePasta.id, info));
        setSharedPastaIds((prev) => new Set([...prev, sharePasta.id]));
      }
    }
    setSharingLoading(false);
  }

  async function handleUpdateShare() {
    if (!shareId) return;
    setSharingLoading(true);
    setShareError(null);
    const { error } = await supabase
      .from("compartilhamentos")
      .update({
        senha: shareSenha.trim() || null,
        expires_at: shareExpiry ? new Date(shareExpiry + "T23:59:59").toISOString() : null,
      })
      .eq("id", shareId);
    if (error) {
      setShareError(error.message);
    } else {
      setShareEditing(false);
      if (sharePasta) {
        setSharedPastaData((prev) => {
          const n = new Map(prev);
          const existing = n.get(sharePasta.id);
          if (existing) n.set(sharePasta.id, { ...existing, senha: shareSenha.trim() || null, expires_at: shareExpiry ? new Date(shareExpiry + "T23:59:59").toISOString() : null });
          return n;
        });
      }
    }
    setSharingLoading(false);
  }

  async function handleRevokeShare() {
    if (!shareId) return;
    setSharingLoading(true);
    await supabase.from("compartilhamentos").delete().eq("id", shareId);
    setShareId(null);
    setShareLink(null);
    setShareSenha("");
    if (sharePasta) {
      setSharedPastaData((prev) => { const n = new Map(prev); n.delete(sharePasta.id); return n; });
      setSharedPastaIds((prev) => { const n = new Set(prev); n.delete(sharePasta.id); return n; });
    }
    setSharingLoading(false);
  }

  async function handleCopy() {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Move foto para outra pasta (ou para a pasta pai se targetId = "parent")
  async function moveFoto(foto: Foto, targetId: number | "parent") {
    if (!userId) return;
    setMoving(true);

    const fromPath = storagePath(foto.name);
    let toBase: string;
    if (targetId === "parent") {
      const parentCrumb = breadcrumb[breadcrumb.length - 2];
      toBase = parentCrumb.id !== null ? `${userId}/${parentCrumb.id}` : `${userId}`;
    } else {
      toBase = `${userId}/${targetId}`;
    }
    const toPath = `${toBase}/${foto.name}`;

    await supabase.storage.from("fotos").move(fromPath, toPath);
    setMoving(false);
    setDraggingFoto(null);
    setDropTarget(null);
    loadItems();
  }

  function navigateTo(pasta: Pasta) {
    setCurrentId(pasta.id);
    setBreadcrumb((prev) => [...prev, { id: pasta.id, nome: pasta.nome }]);
  }

  function navigateToCrumb(crumb: Crumb, index: number) {
    setCurrentId(crumb.id);
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  }

  function goUp() {
    if (breadcrumb.length <= 1) return;
    const prev = breadcrumb[breadcrumb.length - 2];
    setCurrentId(prev.id);
    setBreadcrumb((b) => b.slice(0, -1));
  }

  function startRename(state: RenamingState, currentName: string) {
    setRenaming(state);
    setRenameValue(currentName);
    setTimeout(() => { renameInputRef.current?.select(); }, 30);
  }

  async function commitRename() {
    const newName = renameValue.trim();
    if (!newName || !renaming) { setRenaming(null); return; }
    if (renaming.kind === "pasta") {
      const pasta = pastas.find((p) => p.id === renaming.id);
      if (pasta && newName !== pasta.nome) {
        await supabase.from("pastas").update({ nome: newName, updated_at: new Date().toISOString() }).eq("id", renaming.id);
        loadItems();
      }
    } else {
      const foto = fotos.find((f) => f.name === renaming.name);
      if (foto && newName !== foto.name) {
        const fromPath = storagePath(foto.name);
        const toPath   = storagePath(newName);
        await supabase.storage.from("fotos").move(fromPath, toPath);
        loadItems();
      }
    }
    setRenaming(null);
  }

  const isEmpty = !loading && pastas.length === 0 && fotos.length === 0;
  const totalItens = pastas.length + fotos.length;

  const colHeader = (label: string) => (
    <th
      className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
      style={{ color: "var(--color-text-muted)", whiteSpace: "nowrap" }}
    >
      {label}
    </th>
  );

  return (
    <div
      className="flex flex-col h-full gap-4"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
    >
      {/* ── Header ── */}
      <div>
        <h1
          className="text-3xl font-bold mb-3"
          style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
        >
          Arquivos
        </h1>

        {/* Barra de endereço */}
        <div
          className="flex items-center gap-0 rounded-xl overflow-hidden text-sm"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
        >
          <button
            onClick={() => navigateToCrumb({ id: null, nome: "Início" }, 0)}
            className="flex items-center px-3 py-2 transition-all active:scale-95 shrink-0"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <Home size={13} />
          </button>

          {breadcrumb.map((crumb, i) => (
            <div key={i} className="flex items-center">
              <ChevronRight size={13} style={{ color: "var(--color-border)", flexShrink: 0 }} />
              <button
                onClick={() => navigateToCrumb(crumb, i)}
                className="px-2 py-2 transition-all active:scale-95 font-medium"
                style={{
                  color: i === breadcrumb.length - 1 ? "var(--color-text)" : "var(--color-text-muted)",
                }}
                onMouseEnter={(e) => { if (i < breadcrumb.length - 1) e.currentTarget.style.background = "var(--color-surface-3)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {crumb.nome}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div
        className="flex items-center gap-1 px-3 py-2 rounded-t-xl"
        style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", borderBottom: "none" }}
      >
        {breadcrumb.length > 1 && (
          <button
            onClick={goUp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
            style={{
              color: dropTarget === "parent" ? "var(--color-brand)" : "var(--color-text-muted)",
              background: dropTarget === "parent" ? "color-mix(in srgb, var(--color-brand) 15%, transparent)" : "transparent",
              border: dropTarget === "parent" ? "1px dashed var(--color-brand)" : "1px solid transparent",
            }}
            onMouseEnter={(e) => { if (dropTarget !== "parent") e.currentTarget.style.background = "var(--color-surface-2)"; }}
            onMouseLeave={(e) => { if (dropTarget !== "parent") e.currentTarget.style.background = "transparent"; }}
            onDragOver={(e) => { e.preventDefault(); setDropTarget("parent"); }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => { e.preventDefault(); if (draggingFoto) moveFoto(draggingFoto, "parent"); }}
          >
            <ArrowUp size={13} /> Subir
          </button>
        )}

        <button
          onClick={() => { setFolderName(""); setShowModal(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
          style={{ color: "var(--color-text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <Plus size={13} /> Nova pasta
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
          style={{ color: "var(--color-text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? "Enviando..." : "Upload"}
        </button>

        {selected && (
          <button
            onClick={() => {
              if (selected.startsWith("pasta-")) {
                const id = Number(selected.replace("pasta-", ""));
                const p = pastas.find((p) => p.id === id);
                if (p) startRename({ kind: "pasta", id: p.id }, p.nome);
              } else {
                const name = selected.replace("foto-", "");
                const f = fotos.find((f) => f.name === name);
                if (f) startRename({ kind: "foto", name: f.name }, f.name);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <Pencil size={13} /> Renomear
          </button>
        )}

        {selected?.startsWith("pasta-") && (
          <button
            onClick={() => {
              const id = Number(selected.replace("pasta-", ""));
              const p = pastas.find((p) => p.id === id);
              if (p) openShare(p);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-2)"; e.currentTarget.style.color = "var(--color-brand)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-text-muted)"; }}
          >
            <Share2 size={13} /> Compartilhar
          </button>
        )}

        {selected && (
          <button
            onClick={() => {
              if (selected.startsWith("pasta-")) {
                const id = Number(selected.replace("pasta-", ""));
                const p = pastas.find((p) => p.id === id);
                if (p) deleteFolder(p);
              } else {
                const name = selected.replace("foto-", "");
                const f = fotos.find((f) => f.name === name);
                if (f) deleteFoto(f);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
            style={{ color: "#f87171" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <Trash2 size={13} /> Excluir
          </button>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => handleUpload(e.target.files)} />

        {/* View size buttons — lado direito */}
        <div className="ml-auto flex items-center gap-0.5">
          {(["small", "medium", "large"] as ViewSize[]).map((size, i) => {
            const Icon = i === 0 ? AlignJustify : i === 1 ? LayoutList : LayoutGrid;
            const active = viewSize === size;
            return (
              <button
                key={size}
                onClick={() => setViewSize(size)}
                title={size === "small" ? "Pequeno" : size === "medium" ? "Médio" : "Grande"}
                className="p-1.5 rounded-lg transition-all active:scale-90"
                style={{
                  color: active ? "var(--color-brand)" : "var(--color-text-muted)",
                  background: active ? "color-mix(in srgb, var(--color-brand) 12%, transparent)" : "transparent",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--color-surface-2)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tabela ── */}
      <div
        className="flex-1 rounded-b-xl overflow-hidden flex flex-col relative"
        style={{
          border: dragOver ? "2px dashed var(--color-brand)" : "1px solid var(--color-border)",
          background: "var(--color-surface-2)",
        }}
        onClick={() => setSelected(null)}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-b-xl pointer-events-none"
            style={{ background: "color-mix(in srgb, var(--color-brand) 8%, transparent)" }}
          >
            <Upload size={36} style={{ color: "var(--color-brand)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--color-brand)" }}>Solte as fotos aqui</p>
          </div>
        )}

        {/* Cabeçalho fixo — só em lista */}
        {viewSize !== "large" && (
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "40%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-3)" }}>
                {colHeader("Nome")}
                {colHeader("Data")}
                {colHeader("Tamanho")}
                {colHeader("Status de Compartilhamento")}
                {colHeader("Conf.")}
              </tr>
            </thead>
          </table>
        )}

        {/* Corpo scrollável */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            viewSize === "large" ? (
              /* Skeleton grade */
              <div className="p-5" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex flex-col rounded-xl overflow-hidden animate-fade-in" style={{ animationDelay: `${i * 25}ms`, border: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}>
                    <span className="skeleton w-full" style={{ height: 90 }} />
                    <div className="px-2.5 py-2" style={{ borderTop: "1px solid var(--color-border)" }}>
                      <span className="skeleton h-3 rounded block" style={{ width: `${50 + (i * 23) % 50}px` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Skeleton lista */
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "40%" }} />
                  <col style={{ width: "16%" }} />
                </colgroup>
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => {
                    const cfg = VIEW_CFG[viewSize];
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--color-border)", background: i % 2 === 0 ? "var(--color-surface-2)" : "var(--color-surface)" }}>
                        <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }}>
                          <div className="flex items-center gap-2">
                            <span className="skeleton rounded shrink-0" style={{ width: cfg.iconSize, height: cfg.iconSize }} />
                            <span className="skeleton h-3.5" style={{ width: `${80 + (i * 29) % 80}px` }} />
                          </div>
                        </td>
                        <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }}><span className="skeleton h-3 w-24" /></td>
                        <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }}><span className="skeleton h-3 w-10" /></td>
                        <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }} />
                        <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )

          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "color-mix(in srgb, var(--color-brand) 12%, transparent)" }}>
                <FolderOpen size={26} style={{ color: "var(--color-brand)" }} />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm mb-1" style={{ color: "var(--color-text)" }}>Pasta vazia</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Crie uma pasta, faça upload ou arraste fotos aqui
                </p>
              </div>
            </div>

          ) : viewSize === "large" ? (
            /* ── GRADE GRANDE ── */
            <div
              className="p-5"
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}
              onClick={() => setSelected(null)}
            >
              {/* Pastas em grade */}
              {pastas.map((pasta, i) => {
                const key = `pasta-${pasta.id}`;
                const isSelected = selected === key;
                const isDrop = dropTarget === pasta.id;
                const isRenaming = renaming?.kind === "pasta" && renaming.id === pasta.id;
                return (
                  <div
                    key={key}
                    onClick={(e) => { e.stopPropagation(); setSelected(key); }}
                    onDoubleClick={() => { if (!isRenaming) navigateTo(pasta); }}
                    className="flex flex-col rounded-xl cursor-default select-none animate-fade-in overflow-hidden transition-all"
                    style={{
                      animationDelay: `${i * 25}ms`,
                      border: isDrop
                        ? "2px dashed var(--color-brand)"
                        : isSelected
                        ? "2px solid var(--color-brand)"
                        : "1px solid var(--color-border)",
                      background: isDrop
                        ? "color-mix(in srgb, var(--color-brand) 10%, var(--color-surface-2))"
                        : isSelected
                        ? "color-mix(in srgb, var(--color-brand) 8%, var(--color-surface-2))"
                        : "var(--color-surface-2)",
                      boxShadow: isSelected ? "0 0 0 1px var(--color-brand)" : "none",
                    }}
                    onMouseEnter={(e) => { if (!isSelected && !isDrop) { e.currentTarget.style.borderColor = "var(--color-brand)"; e.currentTarget.style.background = "var(--color-surface-3)"; } }}
                    onMouseLeave={(e) => { if (!isSelected && !isDrop) { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.background = "var(--color-surface-2)"; } }}
                    onDragOver={(e) => { e.preventDefault(); if (draggingFoto) setDropTarget(pasta.id); }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={(e) => { e.preventDefault(); if (draggingFoto) moveFoto(draggingFoto, pasta.id); }}
                  >
                    {/* Área do ícone — mesmo aspect ratio das fotos */}
                    <div className="relative flex items-center justify-center w-full"
                      style={{
                        aspectRatio: "4/3",
                        background: isDrop ? "color-mix(in srgb, var(--color-brand) 10%, var(--color-surface-3))" : "var(--color-surface-3)",
                      }}>
                      <Folder size={64} style={{ color: isDrop ? "var(--color-brand)" : "#e8a838" }} fill={isDrop ? "var(--color-brand)" : "#e8a838"} fillOpacity={0.9} />
                      {sharedPastaIds.has(pasta.id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openShare(pasta); }}
                          title="Ver configurações de compartilhamento"
                          className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium transition-all active:scale-95"
                          style={{ background: "rgba(99,102,241,0.18)", color: "var(--color-brand)", border: "1px solid rgba(99,102,241,0.35)", backdropFilter: "blur(4px)" }}
                        >
                          <Share2 size={9} />
                          Ativo
                        </button>
                      )}
                    </div>
                    {/* Label */}
                    <div className="px-2.5 py-2" style={{ borderTop: "1px solid var(--color-border)" }}>
                      {isRenaming ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-xs text-center px-1 py-0.5 rounded outline-none"
                          style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-brand)", color: "var(--color-text)" }}
                        />
                      ) : (
                        <span
                          className="text-xs font-medium text-center block leading-snug"
                          style={{
                            color: isSelected ? "var(--color-brand)" : "var(--color-text)",
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                          }}
                          onDoubleClick={(e) => { e.stopPropagation(); startRename({ kind: "pasta", id: pasta.id }, pasta.nome); }}
                        >
                          {pasta.nome}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Fotos em grade */}
              {fotos.map((foto, i) => {
                const key = `foto-${foto.name}`;
                const isSelected = selected === key;
                const isDragging = draggingFoto?.name === foto.name;
                const isRenaming = renaming?.kind === "foto" && renaming.name === foto.name;
                return (
                  <div
                    key={key}
                    draggable={!isRenaming}
                    onDragStart={() => { setDraggingFoto(foto); setSelected(key); }}
                    onDragEnd={() => { setDraggingFoto(null); setDropTarget(null); }}
                    onClick={(e) => { e.stopPropagation(); setSelected(key); }}
                    onDoubleClick={() => { if (!isRenaming) setPreview({ url: foto.url, name: foto.name }); }}
                    className="flex flex-col rounded-xl cursor-grab select-none animate-fade-in overflow-hidden transition-all"
                    style={{
                      animationDelay: `${(pastas.length + i) * 25}ms`,
                      border: isSelected ? "2px solid var(--color-brand)" : "1px solid var(--color-border)",
                      background: "var(--color-surface-2)",
                      opacity: isDragging ? 0.4 : 1,
                      boxShadow: isSelected ? "0 0 0 1px var(--color-brand)" : "none",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = "var(--color-brand)"; e.currentTarget.style.background = "var(--color-surface-3)"; } }}
                    onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.background = "var(--color-surface-2)"; } }}
                  >
                    {/* Thumbnail */}
                    <div className="w-full overflow-hidden" style={{ aspectRatio: "4/3" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={foto.url} alt="" className="w-full h-full object-cover" />
                    </div>
                    {/* Label */}
                    <div className="px-2.5 py-2" style={{ borderTop: "1px solid var(--color-border)" }}>
                      {isRenaming ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-xs text-center px-1 py-0.5 rounded outline-none"
                          style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-brand)", color: "var(--color-text)" }}
                        />
                      ) : (
                        <span
                          className="text-xs text-center block leading-snug"
                          style={{
                            color: isSelected ? "var(--color-brand)" : "var(--color-text-muted)",
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                          }}
                          onDoubleClick={(e) => { e.stopPropagation(); startRename({ kind: "foto", name: foto.name }, foto.name); }}
                        >
                          {foto.name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          ) : (
            /* ── LISTA (pequeno / médio) ── */
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "40%" }} />
                <col style={{ width: "16%" }} />
              </colgroup>
              <tbody>
                {/* Pastas */}
                {pastas.map((pasta, i) => {
                  const key = `pasta-${pasta.id}`;
                  const isSelected = selected === key;
                  const isDrop = dropTarget === pasta.id;
                  const isRenaming = renaming?.kind === "pasta" && renaming.id === pasta.id;
                  const cfg = VIEW_CFG[viewSize];
                  const shareData = sharedPastaData.get(pasta.id);
                  return (
                    <tr
                      key={key}
                      onClick={(e) => { e.stopPropagation(); setSelected(key); }}
                      onDoubleClick={() => { if (!isRenaming) navigateTo(pasta); }}
                      className="cursor-default select-none animate-fade-in"
                      style={{
                        animationDelay: `${i * 30}ms`,
                        background: isDrop
                          ? "color-mix(in srgb, var(--color-brand) 20%, transparent)"
                          : isSelected
                          ? "color-mix(in srgb, var(--color-brand) 18%, transparent)"
                          : i % 2 === 0 ? "var(--color-surface-2)" : "var(--color-surface)",
                        borderBottom: isDrop ? "1px dashed var(--color-brand)" : "1px solid var(--color-border)",
                        outline: isDrop ? "1px dashed var(--color-brand)" : "none",
                      }}
                      onMouseEnter={(e) => { if (!isSelected && !isDrop) e.currentTarget.style.background = "var(--color-surface-3)"; }}
                      onMouseLeave={(e) => { if (!isSelected && !isDrop) e.currentTarget.style.background = i % 2 === 0 ? "var(--color-surface-2)" : "var(--color-surface)"; }}
                      onDragOver={(e) => { e.preventDefault(); if (draggingFoto) setDropTarget(pasta.id); }}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={(e) => { e.preventDefault(); if (draggingFoto) moveFoto(draggingFoto, pasta.id); }}
                    >
                      <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Folder size={cfg.iconSize} style={{ color: isDrop ? "var(--color-brand)" : "#e8a838", flexShrink: 0 }} fill={isDrop ? "var(--color-brand)" : "#e8a838"} fillOpacity={0.88} />
                          {isRenaming ? (
                            <input
                              ref={renameInputRef}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                              onClick={(e) => e.stopPropagation()}
                              className={`flex-1 min-w-0 px-2 py-0.5 rounded outline-none ${cfg.fontSize}`}
                              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-brand)", color: "var(--color-text)" }}
                            />
                          ) : (
                            <span
                              className={`${cfg.fontSize} font-medium truncate`}
                              style={{ color: isSelected ? "var(--color-brand)" : "var(--color-text)" }}
                              onDoubleClick={(e) => { e.stopPropagation(); startRename({ kind: "pasta", id: pasta.id }, pasta.nome); }}
                            >
                              {pasta.nome}
                            </span>
                          )}
                          {isSelected && !isRenaming && (
                            <button
                              onClick={(e) => { e.stopPropagation(); startRename({ kind: "pasta", id: pasta.id }, pasta.nome); }}
                              className="shrink-0 p-0.5 rounded transition-opacity"
                              style={{ opacity: 0.5 }}
                              title="Renomear"
                            >
                              <Pencil size={11} style={{ color: "var(--color-text-muted)" }} />
                            </button>
                          )}
                        </div>
                      </td>
                      {/* Data */}
                      <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }}>
                        <span className={cfg.fontSize} style={{ color: "var(--color-text-muted)" }}>{formatDate(pasta.updated_at)}</span>
                      </td>
                      {/* Tamanho — sempre vazio para pastas */}
                      <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }}>
                        <span className={cfg.fontSize} style={{ color: "var(--color-border)" }}>—</span>
                      </td>
                      {/* Status de Compartilhamento — coluna unificada */}
                      <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }}>
                        {shareData ? (
                          <div className="flex items-center flex-wrap gap-1.5">
                            {/* Badge Ativo */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
                              Ativo
                            </div>
                            {/* Senha */}
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium shrink-0" style={{ background: shareData.senha ? "rgba(99,102,241,0.1)" : "var(--color-surface-3)", color: shareData.senha ? "var(--color-brand)" : "var(--color-text-muted)", border: `1px solid ${shareData.senha ? "rgba(99,102,241,0.3)" : "var(--color-border)"}` }} title={shareData.senha ? "Protegido por senha" : "Acesso livre"}>
                              <Lock size={10} />{shareData.senha ? "Com senha" : "Livre"}
                            </div>
                            {/* Validade */}
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium shrink-0" style={{ background: shareData.expires_at ? "rgba(251,146,60,0.08)" : "var(--color-surface-3)", color: shareData.expires_at ? "#fb923c" : "var(--color-text-muted)", border: `1px solid ${shareData.expires_at ? "rgba(251,146,60,0.3)" : "var(--color-border)"}` }} title={shareData.expires_at ? `Expira em ${new Date(shareData.expires_at).toLocaleDateString("pt-BR")}` : "Sem prazo de validade"}>
                              <Calendar size={10} />{shareData.expires_at ? new Date(shareData.expires_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "Sem prazo"}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium w-fit" style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-border)" }} />
                            Não compartilhado
                          </div>
                        )}
                      </td>
                      {/* Conf. */}
                      <td className="px-3" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); openShare(pasta); }}
                          title={shareData ? "Gerenciar compartilhamento" : "Compartilhar pasta"}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 whitespace-nowrap"
                          style={shareData
                            ? { background: "rgba(99,102,241,0.1)", color: "var(--color-brand)", border: "1px solid rgba(99,102,241,0.3)" }
                            : { background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                          onMouseEnter={(e) => { if (!shareData) { e.currentTarget.style.color = "var(--color-brand)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)"; } }}
                          onMouseLeave={(e) => { if (!shareData) { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; } }}
                        >
                          {shareData ? <><Pencil size={10} /> Gerenciar</> : <><Share2 size={10} /> Compartilhar</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Fotos */}
                {fotos.map((foto, i) => {
                  const key = `foto-${foto.name}`;
                  const isSelected = selected === key;
                  const rowIndex = pastas.length + i;
                  const isDragging = draggingFoto?.name === foto.name;
                  const isRenaming = renaming?.kind === "foto" && renaming.name === foto.name;
                  const cfg = VIEW_CFG[viewSize];
                  return (
                    <tr
                      key={key}
                      draggable={!isRenaming}
                      onDragStart={() => { setDraggingFoto(foto); setSelected(key); }}
                      onDragEnd={() => { setDraggingFoto(null); setDropTarget(null); }}
                      onClick={(e) => { e.stopPropagation(); setSelected(key); }}
                      onDoubleClick={() => { if (!isRenaming) setPreview({ url: foto.url, name: foto.name }); }}
                      className="cursor-grab select-none animate-fade-in"
                      style={{
                        animationDelay: `${(pastas.length + i) * 30}ms`,
                        background: isSelected
                          ? "color-mix(in srgb, var(--color-brand) 18%, transparent)"
                          : rowIndex % 2 === 0 ? "var(--color-surface-2)" : "var(--color-surface)",
                        borderBottom: "1px solid var(--color-border)",
                        opacity: isDragging ? 0.45 : 1,
                        transition: "opacity 0.15s",
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--color-surface-3)"; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = rowIndex % 2 === 0 ? "var(--color-surface-2)" : "var(--color-surface)"; }}
                    >
                      <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="rounded-md overflow-hidden shrink-0"
                            style={{ width: cfg.thumbSize, height: cfg.thumbSize, border: "1px solid var(--color-border)" }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={foto.url} alt="" className="w-full h-full object-cover" />
                          </div>
                          {isRenaming ? (
                            <input
                              ref={renameInputRef}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                              onClick={(e) => e.stopPropagation()}
                              className={`flex-1 min-w-0 px-2 py-0.5 rounded outline-none ${cfg.fontSize}`}
                              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-brand)", color: "var(--color-text)" }}
                            />
                          ) : (
                            <span
                              className={`${cfg.fontSize} truncate`}
                              style={{ color: isSelected ? "var(--color-brand)" : "var(--color-text)" }}
                              onDoubleClick={(e) => { e.stopPropagation(); startRename({ kind: "foto", name: foto.name }, foto.name); }}
                            >
                              {foto.name}
                            </span>
                          )}
                          {isSelected && !isRenaming && (
                            <button
                              onClick={(e) => { e.stopPropagation(); startRename({ kind: "foto", name: foto.name }, foto.name); }}
                              className="shrink-0 p-0.5 rounded transition-opacity"
                              style={{ opacity: 0.5 }}
                              title="Renomear"
                            >
                              <Pencil size={11} style={{ color: "var(--color-text-muted)" }} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }}><span className={cfg.fontSize} style={{ color: "var(--color-text-muted)" }}>{formatDate(foto.updatedAt)}</span></td>
                      <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }}><span className={cfg.fontSize} style={{ color: "var(--color-text-muted)" }}>{formatSize(foto.size)}</span></td>
                      <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }} />
                      <td className="px-4" style={{ paddingTop: cfg.py, paddingBottom: cfg.py }} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Status bar */}
        <div
          className="px-4 py-1.5 text-xs flex items-center gap-4"
          style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface-3)", color: "var(--color-text-muted)" }}
        >
          <span>{totalItens} {totalItens === 1 ? "item" : "itens"}</span>
          {moving && (
            <span className="flex items-center gap-1.5" style={{ color: "var(--color-brand)" }}>
              <Loader2 size={11} className="animate-spin" /> Movendo...
            </span>
          )}
          {!moving && draggingFoto && (
            <span style={{ color: "var(--color-text-muted)" }}>
              Arraste para uma pasta para mover
            </span>
          )}
          {!moving && !draggingFoto && selected && (
            <span style={{ color: "var(--color-brand)" }}>
              {selected.startsWith("pasta-")
                ? pastas.find((p) => `pasta-${p.id}` === selected)?.nome
                : selected.replace("foto-", "")
              } — selecionado
            </span>
          )}
        </div>
      </div>

      {/* ── Modal Nova Pasta ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowModal(false)}>
          <div className="w-80 rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base" style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}>
                Nova pasta
              </h3>
              <button onClick={() => setShowModal(false)} className="transition-all active:scale-90">
                <X size={18} style={{ color: "var(--color-text-muted)" }} />
              </button>
            </div>
            <input
              type="text" placeholder="Nome da pasta" value={folderName} autoFocus
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setShowModal(false); }}
              className="px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                Cancelar
              </button>
              <button onClick={handleCreateFolder} disabled={!folderName.trim() || creating}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                style={{ background: "var(--color-brand)", color: "white", opacity: !folderName.trim() ? 0.5 : 1 }}>
                {creating ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Compartilhar ── */}
      {showShare && sharePasta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.65)" }}
          onClick={() => setShowShare(false)}>
          <div className="w-96 rounded-2xl flex flex-col gap-0 overflow-hidden animate-fade-in"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-3)" }}>
              <div className="flex items-center gap-2.5">
                <Share2 size={15} style={{ color: "var(--color-brand)" }} />
                <div>
                  <p className="font-bold text-sm" style={{ color: "var(--color-text)" }}>Compartilhar pasta</p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{sharePasta.nome}</p>
                </div>
              </div>
              <button onClick={() => setShowShare(false)} className="transition-all active:scale-90">
                <X size={17} style={{ color: "var(--color-text-muted)" }} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {sharingLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={20} className="animate-spin" style={{ color: "var(--color-text-muted)" }} />
                </div>
              ) : shareLink ? (
                /* ── Link gerado ── */
                <>
                  {/* Link */}
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                      Link de acesso
                    </p>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                      style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)" }}>
                      <Link size={13} style={{ color: "var(--color-brand)", flexShrink: 0 }} />
                      <p className="text-xs truncate flex-1" style={{ color: "var(--color-text)" }}>{shareLink}</p>
                      <button onClick={handleCopy}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all active:scale-95 shrink-0"
                        style={{ background: copied ? "rgba(74,222,128,0.12)" : "var(--color-surface-2)", color: copied ? "#4ade80" : "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
                        {copied ? <Check size={11} /> : <Copy size={11} />}
                        {copied ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                  </div>

                  {/* Tags de status */}
                  <div className="flex flex-wrap gap-2">
                    {shareSenha ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                        style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "var(--color-brand)" }}>
                        <Lock size={11} /> Senha ativa
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                        style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                        <Lock size={11} /> Sem senha
                      </div>
                    )}
                    {shareExpiry ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                        style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.25)", color: "#fb923c" }}>
                        <Calendar size={11} />
                        Expira {new Date(shareExpiry + "T00:00:00").toLocaleDateString("pt-BR")}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                        style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                        <Calendar size={11} /> Sem validade
                      </div>
                    )}
                  </div>

                  {/* Modo edição */}
                  {shareEditing && (
                    <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)" }}>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                        Editar configurações
                      </p>

                      {/* Senha */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Senha de acesso</label>
                        <div className="relative">
                          <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
                          <input
                            type="text"
                            placeholder="Deixe vazio para remover"
                            value={shareSenha}
                            onChange={(e) => setShareSenha(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                            onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                            onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Validade */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>
                            <Clock size={10} /> Válido até
                          </label>
                          <input
                            type="date"
                            value={shareExpiry}
                            min={new Date().toISOString().split("T")[0]}
                            onChange={(e) => setShareExpiry(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: shareExpiry ? "var(--color-text)" : "var(--color-text-muted)", colorScheme: "dark" }}
                            onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                            onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                          />
                        </div>

                      </div>

                      {shareError && (
                        <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
                          {shareError}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={handleUpdateShare}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.97]"
                          style={{ background: "var(--color-brand)", color: "white" }}>
                          <Check size={13} /> Salvar alterações
                        </button>
                        <button onClick={() => setShareEditing(false)}
                          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.97]"
                          style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={handleCopy}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                      style={{ background: "var(--color-brand)", color: "white" }}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Copiado!" : "Copiar link"}
                    </button>
                    {!shareEditing && (
                      <button onClick={() => setShareEditing(true)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                        style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                        <Pencil size={13} /> Editar
                      </button>
                    )}
                    <button onClick={handleRevokeShare}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                      style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "#f87171" }}>
                      <Trash size={13} /> Revogar
                    </button>
                  </div>
                </>
              ) : (
                /* ── Criar share ── */
                <>
                  {/* Senha */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                      Senha de acesso <span style={{ fontWeight: 400 }}>(opcional)</span>
                    </label>
                    <div className="relative">
                      <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
                      <input
                        type="text"
                        placeholder="Deixe vazio para acesso livre"
                        value={shareSenha}
                        onChange={(e) => setShareSenha(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                        onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                        onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                      />
                    </div>
                  </div>

                  {/* Duas colunas: validade + máx. acessos */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>
                        <Clock size={11} /> Válido até
                      </label>
                      <input
                        type="date"
                        value={shareExpiry}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setShareExpiry(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: shareExpiry ? "var(--color-text)" : "var(--color-text-muted)", colorScheme: "dark" }}
                        onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                        onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                      />
                    </div>

                  </div>

                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Botão direito e atalhos do navegador estarão bloqueados para os visitantes.
                  </p>

                  {shareError && (
                    <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
                      <strong>Erro:</strong> {shareError}
                    </div>
                  )}

                  <button onClick={handleCreateShare}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                    style={{ background: "var(--color-brand)", color: "white" }}>
                    <Share2 size={14} /> Gerar link de compartilhamento
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Preview ── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.88)" }} onClick={() => setPreview(null)}>
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(255,255,255,0.12)", color: "white" }}
            onClick={() => setPreview(null)}
          >
            <X size={20} />
          </button>
          <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.url} alt={preview.name} className="rounded-xl object-contain"
              style={{ maxWidth: "90vw", maxHeight: "82vh" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{preview.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}
