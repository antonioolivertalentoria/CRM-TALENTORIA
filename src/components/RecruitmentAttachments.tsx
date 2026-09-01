"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  registerRecruitmentAttachmentAction,
  deleteRecruitmentAttachmentAction,
  getRecruitmentAttachmentUrlAction,
} from "@/lib/actions";
import { ATTACHMENTS_BUCKET, MAX_ATTACHMENT_MB } from "@/lib/constants";
import { formatSize } from "./TaskAttachments";
import type { RecruitmentAttachment } from "@/lib/types";

function safeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
}

function fileIcon(mime: string, name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime === "application/pdf" || ext === "pdf") return "📕";
  if (["doc", "docx"].includes(ext)) return "📘";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📗";
  if (["ppt", "pptx"].includes(ext)) return "📙";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  return "📎";
}

async function uploadFiles(
  vacancyId: string,
  list: File[],
  category: "candidato" | "proceso",
  candidateId: string | undefined,
  onOk: (a: RecruitmentAttachment) => void,
  onError: (msg: string) => void
) {
  const supabase = createClient();
  for (const file of list) {
    const path = `reclutamiento/${vacancyId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upErr) {
      onError(`No se pudo subir ${file.name}: ${upErr.message}`);
      continue;
    }
    const res = await registerRecruitmentAttachmentAction({
      vacancyId,
      storagePath: path,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "",
      category,
      candidateId,
    });
    if ("error" in res) {
      onError(`Se subió ${file.name} pero no se pudo registrar: ${res.error}`);
      continue;
    }
    onOk(res.attachment);
  }
}

/**
 * Archivos del proceso de reclutamiento: CVs, psicometrías, referencias y
 * documentos de la vacante. Suben directo del navegador al bucket privado
 * y bajan con URL firmada, igual que en el resto del CRM.
 */
export function RecruitmentAttachments({
  vacancyId,
  attachments,
  itemLabels = {},
}: {
  vacancyId: string;
  attachments: RecruitmentAttachment[];
  /** Nombre del candidato del que cuelga cada archivo (por id de archivo). */
  itemLabels?: Record<string, string>;
}) {
  const [items, setItems] = useState<RecruitmentAttachment[]>(attachments);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[]) => {
    setError("");
    const all = Array.from(files);
    const tooBig = all.filter((f) => f.size > MAX_ATTACHMENT_MB * 1024 * 1024);
    if (tooBig.length > 0) {
      setError(
        `Estos archivos pasan de ${MAX_ATTACHMENT_MB} MB y no se subieron: ${tooBig.map((f) => f.name).join(", ")}. Para pesados usa Drive y pega la liga.`
      );
    }
    const ok = all.filter((f) => f.size <= MAX_ATTACHMENT_MB * 1024 * 1024);
    if (ok.length === 0) return;

    setUploading(ok.map((f) => f.name));
    await uploadFiles(
      vacancyId,
      ok,
      "proceso",
      undefined,
      (a) => setItems((prev) => [...prev, a]),
      (msg) => setError(msg)
    );
    setUploading([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const open = (att: RecruitmentAttachment) => {
    startTransition(async () => {
      const res = await getRecruitmentAttachmentUrlAction(att.id);
      if ("error" in res) setError(res.error);
      else window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  const remove = (att: RecruitmentAttachment) => {
    if (!confirm(`¿Eliminar el archivo "${att.file_name}"?`)) return;
    startTransition(async () => {
      const res = await deleteRecruitmentAttachmentAction(att.id);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== att.id));
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Archivos del proceso ({items.length})
        </h2>
      </div>
      <div className="p-4">
        <p className="mb-3 text-xs text-slate-400">
          Requisición, levantamiento autorizado, evidencias de publicación y todo lo que no cuelga
          de un candidato. Los CVs y psicometrías de cada persona se suben con el clip 📎 de su
          renglón y también aparecen aquí.
        </p>

        {items.length > 0 && (
          <ul className="mb-3 space-y-1">
            {items.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
              >
                <span className="shrink-0">{fileIcon(att.mime_type, att.file_name)}</span>
                <button
                  onClick={() => open(att)}
                  disabled={pending}
                  className="min-w-0 flex-1 truncate text-left text-xs font-medium text-brand-cyan-dark hover:underline disabled:opacity-60"
                  title={`Abrir ${att.file_name}`}
                >
                  {att.file_name}
                </button>
                {itemLabels[att.id] && (
                  <span
                    className="max-w-32 shrink-0 truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                    title={itemLabels[att.id]}
                  >
                    {itemLabels[att.id]}
                  </span>
                )}
                <span className="shrink-0 text-[11px] text-slate-400">{formatSize(att.file_size)}</span>
                <button
                  onClick={() => remove(att)}
                  disabled={pending}
                  title="Eliminar archivo"
                  className="shrink-0 text-slate-300 transition hover:text-red-500"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        {uploading.length > 0 && (
          <p className="mb-2 text-xs text-slate-400">Subiendo {uploading.join(", ")}…</p>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length > 0) upload(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed px-3 py-3 text-center text-xs transition ${
            dragging
              ? "border-brand-cyan bg-brand-cyan/10 text-brand-cyan-dark"
              : "border-slate-300 bg-white text-slate-400 hover:border-brand-cyan hover:text-brand-cyan-dark"
          }`}
        >
          📎 Arrastra archivos aquí o haz clic para elegirlos
          <span className="block text-[10px] text-slate-400">Hasta {MAX_ATTACHMENT_MB} MB por archivo</span>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) upload(e.target.files);
          }}
        />

        {error && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Clip 📎 por candidato: CV, psicometría y referencias de UNA persona.
 * Los archivos también aparecen en "Archivos del proceso", etiquetados
 * con el nombre del candidato.
 */
export function CandidateFiles({
  vacancyId,
  candidateId,
  candidateName,
  files,
}: {
  vacancyId: string;
  candidateId: string;
  candidateName: string;
  files: RecruitmentAttachment[];
}) {
  const [items, setItems] = useState<RecruitmentAttachment[]>(files);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (list: FileList) => {
    setError("");
    const ok = Array.from(list).filter((f) => f.size <= MAX_ATTACHMENT_MB * 1024 * 1024);
    if (Array.from(list).length > ok.length) {
      setError(`Máximo ${MAX_ATTACHMENT_MB} MB por archivo; para pesados usa Drive.`);
    }
    if (ok.length === 0) return;

    setUploading(true);
    await uploadFiles(
      vacancyId,
      ok,
      "candidato",
      candidateId,
      (a) => setItems((prev) => [...prev, a]),
      (msg) => setError(msg)
    );
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const openFile = (att: RecruitmentAttachment) => {
    startTransition(async () => {
      const res = await getRecruitmentAttachmentUrlAction(att.id);
      if ("error" in res) setError(res.error);
      else window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  const remove = (att: RecruitmentAttachment) => {
    if (!confirm(`¿Eliminar el archivo "${att.file_name}"?`)) return;
    startTransition(async () => {
      const res = await deleteRecruitmentAttachmentAction(att.id);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== att.id));
    });
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        title={`CV, psicometría y referencias de ${candidateName}`}
        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
          items.length > 0
            ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan-dark hover:bg-brand-cyan/20"
            : "border-slate-200 bg-white text-slate-400 hover:border-brand-cyan hover:text-brand-cyan-dark"
        }`}
      >
        📎 {items.length || "+"}
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-20 w-72 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg">
          <p className="mb-2 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            📄 Documentos de {candidateName}
          </p>
          {items.length > 0 && (
            <ul className="mb-2 space-y-1">
              {items.map((att) => (
                <li key={att.id} className="flex items-center gap-2 text-xs">
                  <span className="shrink-0">{fileIcon(att.mime_type, att.file_name)}</span>
                  <button
                    onClick={() => openFile(att)}
                    disabled={pending}
                    className="min-w-0 flex-1 truncate text-left font-medium text-brand-cyan-dark hover:underline disabled:opacity-60"
                    title={`Abrir ${att.file_name}`}
                  >
                    {att.file_name}
                  </button>
                  <span className="shrink-0 text-[10px] text-slate-400">{formatSize(att.file_size)}</span>
                  <button
                    onClick={() => remove(att)}
                    disabled={pending}
                    title="Eliminar archivo"
                    className="shrink-0 text-slate-300 transition hover:text-red-500"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full rounded-lg border-2 border-dashed border-slate-300 px-2 py-1.5 text-[11px] text-slate-400 transition hover:border-brand-cyan hover:text-brand-cyan-dark disabled:opacity-60"
          >
            {uploading ? "Subiendo…" : "📎 Subir CV, psicometría o referencias"}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) upload(e.target.files);
            }}
          />
          {error && <p className="mt-1.5 text-[11px] text-amber-600">{error}</p>}
          <button onClick={() => setOpen(false)} className="mt-2 text-[11px] text-slate-400 hover:text-slate-600">
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
