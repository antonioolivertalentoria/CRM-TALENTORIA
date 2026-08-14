"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createCustomTaskAction, registerAttachmentAction } from "@/lib/actions";
import { ATTACHMENTS_BUCKET, MAX_ATTACHMENT_MB } from "@/lib/constants";
import { formatSize } from "./TaskAttachments";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

function safeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
}

/**
 * Tareas propias: lo que pide la jefa, lo que se le pide a ella,
 * pendientes de marca blanca o de algún cliente. Se mezclan con las
 * tareas automáticas en la misma lista.
 *
 * Los archivos se eligen antes de guardar, pero se suben después de crear
 * la tarea (necesitan su id) y van directo del navegador a Supabase Storage.
 */
export function NewTaskForm({
  people,
  clients,
  currentUser = "",
}: {
  people: string[];
  clients: { id: string; company: string }[];
  currentUser?: string;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list);
    const tooBig = incoming.filter((f) => f.size > MAX_ATTACHMENT_MB * 1024 * 1024);
    if (tooBig.length > 0) {
      setError(
        `Estos archivos pasan de ${MAX_ATTACHMENT_MB} MB y no se adjuntaron: ${tooBig.map((f) => f.name).join(", ")}.`
      );
    }
    setFiles((prev) => [...prev, ...incoming.filter((f) => f.size <= MAX_ATTACHMENT_MB * 1024 * 1024)]);
  };

  const submit = (formData: FormData) => {
    setError("");
    startTransition(async () => {
      const res = await createCustomTaskAction(formData);
      if ("error" in res) {
        setError(res.error);
        return;
      }

      if (files.length > 0) {
        const supabase = createClient();
        for (const file of files) {
          setStatus(`Subiendo ${file.name}…`);
          const path = `tareas/${res.taskId}/${crypto.randomUUID()}-${safeName(file.name)}`;
          const { error: upErr } = await supabase.storage
            .from(ATTACHMENTS_BUCKET)
            .upload(path, file, { contentType: file.type || "application/octet-stream" });
          if (upErr) {
            setError(`La tarea se creó, pero no se pudo subir ${file.name}: ${upErr.message}`);
            continue;
          }
          await registerAttachmentAction({
            taskId: res.taskId,
            storagePath: path,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "",
          });
        }
        setStatus("");
      }

      setFiles([]);
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gradient-to-r from-brand-cyan to-brand-magenta px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
      >
        + Nueva tarea
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-brand-cyan/30 bg-white p-5 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-brand-navy">Nueva tarea</h2>
        <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <form action={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">¿Qué hay que hacer? *</label>
          <input name="title" required placeholder="Ej. Preparar propuesta de teambuilding" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Para quién es la tarea</label>
          <select name="assignee" defaultValue={currentUser} className={input}>
            <option value="">— Sin asignar</option>
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Fecha límite</label>
          <input name="due_date" type="date" className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Cliente relacionado</label>
          <select name="client_id" defaultValue="" className={input}>
            <option value="">Marca blanca / interno (sin cliente)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Detalles (opcional)</label>
          <textarea name="details" rows={3} placeholder="Contexto, links, lo que haga falta…" className={input + " resize-y"} />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Archivos adjuntos (opcional)</label>
          {files.length > 0 && (
            <ul className="mb-2 space-y-1">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5"
                >
                  <span>📎</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{f.name}</span>
                  <span className="text-[11px] text-slate-400">{formatSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, x) => x !== i))}
                    className="text-slate-300 transition hover:text-red-500"
                    title="Quitar"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
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
              if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed px-3 py-3 text-center text-xs transition ${
              dragging
                ? "border-brand-cyan bg-brand-cyan/10 text-brand-cyan-dark"
                : "border-slate-300 text-slate-400 hover:border-brand-cyan hover:text-brand-cyan-dark"
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
              if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {error && (
          <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Crear tarea"}
          </button>
          {status && <span className="text-xs text-slate-400">{status}</span>}
        </div>
      </form>
    </div>
  );
}
