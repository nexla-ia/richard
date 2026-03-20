"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Lock, Folder, X, ZoomIn, Images, Home, ChevronRight, Download, Loader2 } from "lucide-react";

type PastaItem = { id: number; nome: string };
type FotoItem  = { name: string; url: string; size?: number };
type Crumb     = { id: number | null; nome: string };

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>();

  const [state, setState]         = useState<"loading" | "password" | "gallery" | "error">("loading");
  const [senha, setSenha]         = useState("");
  const [senhaOk, setSenhaOk]     = useState<string | null>(null); // senha validada
  const [senhaError, setSenhaError] = useState("");
  const [nomeRaiz, setNomeRaiz]   = useState("");
  const [pastas, setPastas]       = useState<PastaItem[]>([]);
  const [fotos, setFotos]         = useState<FotoItem[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<Crumb[]>([]);
  const [navLoading, setNavLoading] = useState(false);
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);

  async function handleDownload(e: React.MouseEvent, foto: FotoItem, idx: number) {
    e.stopPropagation();
    setDownloadingIdx(idx);
    try {
      const res = await fetch(foto.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = foto.name;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingIdx(null);
    }
  }
  const [preview, setPreview]     = useState<{ foto: FotoItem; idx: number } | null>(null);
  const [errorMsg, setErrorMsg]   = useState("");
  const senhaRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchFolder(null, null); }, [token]);
  useEffect(() => { if (state === "password") senhaRef.current?.focus(); }, [state]);

  // Bloqueia botão direito, F12 e atalhos de devtools
  useEffect(() => {
    const blockCtxMenu = (e: MouseEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C", "K"].includes(e.key)) ||
        (e.ctrlKey && ["u", "U", "s", "S"].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("contextmenu", blockCtxMenu);
    document.addEventListener("keydown", blockKeys, true);
    return () => {
      document.removeEventListener("contextmenu", blockCtxMenu);
      document.removeEventListener("keydown", blockKeys, true);
    };
  }, []);

  async function fetchFolder(pastaId: number | null, pw: string | null) {
    const res = await fetch(`/api/s/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha: pw ?? senhaOk, current_pasta_id: pastaId }),
    });
    const data = await res.json();

    if (res.ok) {
      setNomeRaiz(data.nome);
      setPastas(data.pastas ?? []);
      setFotos(data.fotos ?? []);
      if (pw !== null) setSenhaOk(pw);
      // Breadcrumb: se é a raiz, limpa; caso contrário mantém o stack
      if (pastaId === null) {
        setBreadcrumb([{ id: null, nome: data.nome }]);
      }
      setState("gallery");
    } else if (res.status === 401 && data.passwordRequired) {
      setState("password");
    } else if (res.status === 401) {
      setSenhaError(data.error ?? "Senha incorreta.");
    } else {
      setErrorMsg(data.error ?? "Link inválido.");
      setState("error");
    }
  }

  async function navigateTo(pasta: PastaItem) {
    setNavLoading(true);
    setBreadcrumb((b) => [...b, { id: pasta.id, nome: pasta.nome }]);
    const res = await fetch(`/api/s/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha: senhaOk, current_pasta_id: pasta.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setPastas(data.pastas ?? []);
      setFotos(data.fotos ?? []);
    }
    setNavLoading(false);
  }

  async function navigateToCrumb(crumb: Crumb, index: number) {
    setNavLoading(true);
    setBreadcrumb((b) => b.slice(0, index + 1));
    const res = await fetch(`/api/s/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha: senhaOk, current_pasta_id: crumb.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setPastas(data.pastas ?? []);
      setFotos(data.fotos ?? []);
    }
    setNavLoading(false);
  }

  function handleSubmitSenha(e: React.SyntheticEvent) {
    e.preventDefault();
    setSenhaError("");
    fetchFolder(null, senha);
  }

  function prevPhoto() {
    if (!preview) return;
    const idx = (preview.idx - 1 + fotos.length) % fotos.length;
    setPreview({ foto: fotos[idx], idx });
  }
  function nextPhoto() {
    if (!preview) return;
    const idx = (preview.idx + 1) % fotos.length;
    setPreview({ foto: fotos[idx], idx });
  }

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft")  prevPhoto();
      if (e.key === "ArrowRight") nextPhoto();
      if (e.key === "Escape")     setPreview(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const isEmpty = pastas.length === 0 && fotos.length === 0 && !navLoading;

  // ── Loading inicial ──
  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f0f13" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#6366f1 transparent transparent transparent" }} />
      </div>
    );
  }

  // ── Erro ──
  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f0f13" }}>
        <div className="flex flex-col items-center gap-4 text-center p-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(248,113,113,0.12)" }}>
            <X size={28} style={{ color: "#f87171" }} />
          </div>
          <p className="font-bold text-lg" style={{ color: "#e8e8f0" }}>Link inválido</p>
          <p className="text-sm" style={{ color: "#8888aa" }}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ── Senha ──
  if (state === "password") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0f0f13" }}>
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
              <Lock size={24} style={{ color: "#6366f1" }} />
            </div>
            <h1 className="text-xl font-bold" style={{ color: "#e8e8f0" }}>Pasta protegida</h1>
            <p className="text-sm mt-1" style={{ color: "#8888aa" }}>
              Digite a senha para acessar as fotos
            </p>
          </div>
          <form onSubmit={handleSubmitSenha} className="flex flex-col gap-3">
            <input
              ref={senhaRef}
              type="password"
              placeholder="Senha de acesso"
              value={senha}
              onChange={(e) => { setSenha(e.target.value); setSenhaError(""); }}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: "#18181f",
                border: `1px solid ${senhaError ? "#f87171" : "#2e2e3f"}`,
                color: "#e8e8f0",
              }}
            />
            {senhaError && <p className="text-xs" style={{ color: "#f87171" }}>{senhaError}</p>}
            <button type="submit" disabled={!senha}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
              style={{ background: "#6366f1", color: "white", opacity: !senha ? 0.5 : 1 }}>
              Acessar
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Galeria ──
  const totalItens = pastas.length + fotos.length;

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0f0f13", userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 px-5 py-3 flex items-center gap-3"
        style={{ background: "rgba(15,15,19,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #2e2e3f" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(99,102,241,0.15)" }}>
          <Folder size={16} style={{ color: "#6366f1" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: "#e8e8f0" }}>{nomeRaiz}</p>
          <p className="text-xs" style={{ color: "#8888aa" }}>
            {totalItens} {totalItens === 1 ? "item" : "itens"}
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      {breadcrumb.length > 1 && (
        <div className="px-5 py-2 flex items-center gap-0.5 flex-wrap"
          style={{ borderBottom: "1px solid #1a1a24" }}>
          {breadcrumb.map((crumb, i) => (
            <div key={i} className="flex items-center">
              {i > 0 && <ChevronRight size={12} style={{ color: "#3a3a4f", margin: "0 2px" }} />}
              <button
                onClick={() => navigateToCrumb(crumb, i)}
                className="px-1.5 py-0.5 rounded text-xs transition-all"
                style={{
                  color: i === breadcrumb.length - 1 ? "#e8e8f0" : "#8888aa",
                  fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
                }}
              >
                {i === 0 ? <Home size={11} /> : crumb.nome}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Conteúdo */}
      <div className="p-5">
        {navLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "#6366f1 transparent transparent transparent" }} />
          </div>

        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.12)" }}>
              <Images size={24} style={{ color: "#6366f1" }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: "#e8e8f0" }}>Pasta vazia</p>
          </div>

        ) : (
          <div className="flex flex-col gap-5">
            {/* Pastas */}
            {pastas.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: "#555570" }}>
                  Pastas
                </p>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                  {pastas.map((pasta) => (
                    <button
                      key={pasta.id}
                      onClick={() => navigateTo(pasta)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all active:scale-95 animate-fade-in"
                      style={{ background: "#18181f", border: "1px solid #2e2e3f" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f1"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2e2e3f"; }}
                    >
                      <Folder size={20} style={{ color: "#e8a838", flexShrink: 0 }} fill="#e8a838" fillOpacity={0.85} />
                      <span className="text-sm font-medium truncate" style={{ color: "#e8e8f0" }}>
                        {pasta.nome}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fotos */}
            {fotos.length > 0 && (
              <div>
                {pastas.length > 0 && (
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color: "#555570" }}>
                    Fotos
                  </p>
                )}
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                  {fotos.map((foto, i) => (
                    <div
                      key={foto.name}
                      onClick={() => setPreview({ foto, idx: i })}
                      className="group relative rounded-xl overflow-hidden animate-fade-in cursor-pointer"
                      style={{
                        aspectRatio: "1",
                        background: "#18181f",
                        border: "1px solid #2e2e3f",
                        animationDelay: `${i * 25}ms`,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f1"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2e2e3f"; }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={foto.url} alt={foto.name} draggable={false}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        style={{ pointerEvents: "none" }} />
                      <div className="absolute inset-0 flex flex-col justify-between p-3 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }}>
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={(e) => handleDownload(e, foto, i)}
                            title="Baixar foto"
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90"
                            style={{ background: "rgba(255,255,255,0.15)" }}
                          >
                            {downloadingIdx === i
                              ? <Loader2 size={12} className="text-white animate-spin" />
                              : <Download size={12} className="text-white" />}
                          </button>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center"
                            style={{ background: "rgba(255,255,255,0.15)" }}>
                            <ZoomIn size={13} className="text-white" />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-white font-medium truncate">{foto.name}</p>
                          {foto.size && <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{formatSize(foto.size)}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview fullscreen */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setPreview(null)}>
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 z-10"
            style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
            onClick={() => setPreview(null)}>
            <X size={18} />
          </button>
          {fotos.length > 1 && (
            <button className="absolute left-4 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 z-10 text-white text-2xl font-light"
              style={{ background: "rgba(255,255,255,0.1)" }}
              onClick={(e) => { e.stopPropagation(); prevPhoto(); }}>
              ‹
            </button>
          )}
          <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.foto.url} alt={preview.foto.name}
              className="rounded-xl object-contain animate-fade-in-fast"
              style={{ maxWidth: "88vw", maxHeight: "80vh" }} />
            <div className="flex items-center gap-3">
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{preview.foto.name}</p>
              {fotos.length > 1 && (
                <p className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>
                  {preview.idx + 1} / {fotos.length}
                </p>
              )}
            </div>
          </div>
          {fotos.length > 1 && (
            <button className="absolute right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 z-10 text-white text-2xl font-light"
              style={{ background: "rgba(255,255,255,0.1)" }}
              onClick={(e) => { e.stopPropagation(); nextPhoto(); }}>
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}
