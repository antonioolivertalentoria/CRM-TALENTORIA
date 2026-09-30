"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  registerTrainingAttachmentAction,
  deleteTrainingAttachmentAction,
  getTrainingAttachmentUrlAction,
} from "@/lib/actions";
import { ATTACHMENTS_BUCKET, MAX_ATTACHMENT_MB, quoteFolder } from "@/lib/constants";
import { safeName, fileIcon } from "./TrainingAttachments";
import type { TrainingAttachment } from "@/lib/types";

/**
 * Cotización de la capacitación, junto a Temario y Lista de participantes.
 * Es un archivo (no un link): sube directo del navegador al bucket privado
 * y se abre con URL firmada, igual que los archivos de team building.
 * Acepta varias por si hay versiones (la más nueva va al final).
 */
export function QuoteFiles({
  trainingId,
  files,
}: {
  trainingId: string;
  files: TrainingAttachment[];
}) {
  const [items, setItems] = useState<TrainingAttachment[]>(files);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (list: FileList | File[]) => {
    setError("");
    const all = Array.from(list);
    const ok = all.filter((f) => f.size <= MAX_ATTACHMENT_MB * 1024 * 1024);
    if (ok.length < all.length) {
      setError(`La cotización pasa de ${MAX_ATTACHMENT_MB} MB; súbela a Drive y pega la liga en las notas.`);
    }
    if (ok.length === 0) return;

    setUploading(true);
    const supabase = createClient();

    for (const file of ok) {
      const path = `${quoteFolder(trainingId)}${crypto.randomUUID()}-${safeName(file.name)}`;
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

    setUploading(false);
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
    if (!confirm(`¿Eliminar la cotización "${att.file_name}"?`)) return;
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
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="shrink-0 text-xs font-medium text-slate-500">Cotización:</span>

      {items.map((att) => (
        <span
          key={att.id}
          className="inline-flex max-w-56 items-center gap-1 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 py-1 pl-2.5 pr-1.5 text-xs font-semibold text-brand-cyan-dark"
        >
          <span className="shrink-0">{fileIcon(att.mime_type, att.file_name)}</span>
          <button
            onClick={() => open(att)}
            disabled={pending}
            title={`Abrir ${att.file_name}${att.uploaded_by ? ` (subió ${att.uploaded_by})` : ""}`}
            className="min-w-0 truncate hover:underline disabled:opacity-60"
          >
            {att.file_name}
          </button>
          <button
            onClick={() => remove(att)}
            disabled={pending}
            title="Eliminar cotización"
            className="shrink-0 text-brand-cyan-dark/40 transition hover:text-red-500"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
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
        disabled={uploading}
        title={`Elige o arrastra aquí el archivo (PDF, Word, Excel… hasta ${MAX_ATTACHMENT_MB} MB)`}
        className={`inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs transition disabled:opacity-60 ${
          dragging
            ? "border-brand-cyan bg-brand-cyan/10 text-brand-cyan-dark"
            : "border-slate-300 text-slate-400 hover:border-brand-cyan hover:text-brand-cyan-dark"
        }`}
      >
        {uploading ? "Subiendo…" : items.length === 0 ? "📎 Subir cotización" : "📎 Otra versión"}
      </button>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) upload(e.target.files);
        }}
      />

      {error && <span className="w-full text-[11px] text-amber-700">{error}</span>}
    </div>
  );
}
