"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  registerTrainingAttachmentAction,
  deleteTrainingAttachmentAction,
  getTrainingAttachmentUrlAction,
} from "@/lib/actions";
import { ATTACHMENTS_BUCKET, MAX_ATTACHMENT_MB } from "@/lib/constants";
import { formatSize } from "./TaskAttachments";
import type { TrainingAttachment } from "@/lib/types";

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

/**
 * Archivos de un team building (diseños de gafetes, listas, cotizaciones…):
 * se suben directo del navegador al bucket privado y se bajan con URL
 * firmada temporal, igual que los adjuntos de tareas.
 */
export function TrainingAttachments({
  trainingId,
  attachments,
}: {
  trainingId: string;
  attachments: TrainingAttachment[];
}) {
  const [items, setItems] = useState<TrainingAttachment[]>(attachments);
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
        `Estos archivos pasan de ${MAX_ATTACHMENT_MB} MB y no se subieron: ${tooBig.map((f) => f.name).join(", ")}. Para archivos pesados, usa Drive y pega la liga en las notas.`
      );
    }
    const ok = list.filter((f) => f.size <= MAX_ATTACHMENT_MB * 1024 * 1024);
    if (ok.length === 0) return;

    setUploading(ok.map((f) => f.name));
    const supabase = createClient();

    for (const file of ok) {
      const path = `teambuildings/${trainingId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(path, file, { contentType: file.type || "application/octet-stream" });

      if (upErr) {
        setError(`No se pudo subir ${file.name}: ${upErr.message}`);
        continue;
      }

      const res = await registerTrainingAttachmentAction({
        trainingId,
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
  };

  const open = (att: TrainingAttachment) => {
    startTransition(async () => {
      const res = await getTrainingAttachmentUrlAction(att.id);
      if ("error" in res) setError(res.error);
      else window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  const remove = (att: TrainingAttachment) => {
    if (!confirm(`¿Eliminar el archivo "${att.file_name}"?`)) return;
    startTransition(async () => {
      const res = await deleteTrainingAttachmentAction(att.id);
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
          Archivos ({items.length})
        </h2>
      </div>
      <div className="p-4">
        <p className="mb-3 text-xs text-slate-400">
          Todo lo del evento a la mano: diseños de gafetes, listas de participantes,
          cotizaciones… Haz clic en un archivo para abrirlo o descargarlo.
        </p>

        {items.length > 0 && (
          <ul className="mb-3 grid gap-1.5 sm:grid-cols-2">
            {items.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"
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
                <span className="shrink-0 text-[11px] text-slate-400">{formatSize(att.file_size)}</span>
                {att.uploaded_by && (
                  <span className="hidden shrink-0 text-[11px] text-slate-300 sm:inline" title={`Subió: ${att.uploaded_by}`}>
                    {att.uploaded_by.split(" ")[0]}
                  </span>
                )}
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
