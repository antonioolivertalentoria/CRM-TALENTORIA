"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  registerAttachmentAction,
  deleteAttachmentAction,
  getAttachmentUrlAction,
} from "@/lib/actions";
import { ATTACHMENTS_BUCKET, MAX_ATTACHMENT_MB } from "@/lib/constants";
import type { TaskAttachment } from "@/lib/types";

/**
 * Nombre seguro para Storage: NFD separa los acentos de su letra y el filtro
 * siguiente deja solo [a-zA-Z0-9._-], así que quedan fuera acentos y espacios.
 */
function safeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

/**
 * Sube archivos DIRECTO del navegador a Supabase Storage (las Server Actions
 * tienen un tope de 1 MB, así que el archivo no pasa por el servidor) y luego
 * registra la referencia en la base. Los archivos son privados: se abren con
 * una URL firmada temporal generada al dar clic.
 */
export function TaskAttachments({
  taskId,
  attachments,
  onChanged,
}: {
  taskId: string;
  attachments: TaskAttachment[];
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<TaskAttachment[]>(attachments);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[]) => {
    setError("");
    const list = Array.from(files);
    const tooBig = list.filter((f) => f.size > MAX_ATTACHMENT_MB * 1024 * 1024);
    if (tooBig.length > 0) {
      setError(
        `Estos archivos pasan de ${MAX_ATTACHMENT_MB} MB y no se subieron: ${tooBig.map((f) => f.name).join(", ")}. Para archivos pesados, sube el material a Drive y pega la liga en los detalles.`
      );
    }
    const ok = list.filter((f) => f.size <= MAX_ATTACHMENT_MB * 1024 * 1024);
    if (ok.length === 0) return;

    setUploading(ok.map((f) => f.name));
    const supabase = createClient();

    for (const file of ok) {
      const path = `tareas/${taskId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(path, file, { contentType: file.type || "application/octet-stream" });

      if (upErr) {
        setError(`No se pudo subir ${file.name}: ${upErr.message}`);
        continue;
      }

      const res = await registerAttachmentAction({
        taskId,
        storagePath: path,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "",
      });

      if ("error" in res) {
        setError(`Se subió ${file.name} pero no se pudo registrar: ${res.error}`);
        continue;
      }

      setItems((prev) => [...prev, res.attachment]);
    }

    setUploading([]);
    if (inputRef.current) inputRef.current.value = "";
    onChanged?.();
  };

  const open = (att: TaskAttachment) => {
    if (att.id.startsWith("temp-")) {
      setError("Recarga la página para poder abrir este archivo recién subido.");
      return;
    }
    startTransition(async () => {
      const res = await getAttachmentUrlAction(att.id);
      if ("error" in res) setError(res.error);
      else window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  const remove = (att: TaskAttachment) => {
    if (!confirm(`¿Eliminar el archivo "${att.file_name}"?`)) return;
    startTransition(async () => {
      if (!att.id.startsWith("temp-")) {
        const res = await deleteAttachmentAction(att.id);
        if (res?.error) {
          setError(res.error);
          return;
        }
      }
      setItems((prev) => prev.filter((x) => x.id !== att.id));
      onChanged?.();
    });
  };

  return (
    <div>
      <label className="mb-0.5 block text-[11px] font-semibold text-slate-500">
        Archivos adjuntos
      </label>

      {items.length > 0 && (
        <ul className="mb-2 space-y-1">
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
              <span className="shrink-0 text-[11px] text-slate-400">
                {formatSize(att.file_size)}
              </span>
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
        className={`cursor-pointer rounded-lg border-2 border-dashed px-3 py-2.5 text-center text-xs transition ${
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
  );
}
