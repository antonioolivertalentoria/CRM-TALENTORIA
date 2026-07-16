"use client";

import { useState, useTransition, useActionState } from "react";
import {
  createMaterialAction,
  updateMaterialField,
  deleteMaterialAction,
  addMaterialCommentAction,
} from "@/lib/actions";
import { MATERIAL_TYPES, MATERIAL_STATUSES } from "@/lib/constants";
import { StatusSelect } from "./StatusSelect";
import { EditableField } from "./EditableField";
import type { Material, MaterialComment } from "@/lib/types";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30";

const TYPE_ICON: Record<string, string> = {
  PPT: "📊",
  "Manual participante": "📘",
  "Manual ejercicios": "📝",
  Temario: "📋",
  "Lista participantes": "👥",
  Encuesta: "📈",
  Constancias: "🎓",
  Otro: "📎",
};

function PersonSelect({
  value,
  people,
  placeholder,
  onChange,
}: {
  value: string;
  people: string[];
  placeholder: string;
  onChange: (v: string) => Promise<unknown> | void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        startTransition(async () => {
          await onChange(v);
        });
      }}
      className={`cursor-pointer rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs outline-none transition hover:border-slate-300 focus:border-brand-cyan ${
        value ? "font-medium text-slate-700" : "text-slate-400"
      } disabled:opacity-50`}
    >
      <option value="">{placeholder}</option>
      {people.map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
    </select>
  );
}

function Comments({
  material,
  trainingId,
  comments,
}: {
  material: Material;
  trainingId: string;
  comments: MaterialComment[];
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="w-full rounded-lg bg-slate-50 p-3">
      {comments.length === 0 ? (
        <p className="text-xs text-slate-400">Sin comentarios. Escribe el primero (por ejemplo, ajustes de la revisión).</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <span className="font-semibold text-brand-navy">{c.author}</span>
              <span className="ml-2 text-[11px] text-slate-400">
                {new Date(c.created_at).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
              <p className="text-slate-700">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un comentario…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim() && !pending) {
              startTransition(async () => {
                await addMaterialCommentAction(material.id, trainingId, text);
                setText("");
              });
            }
          }}
          className={input + " !py-1.5 text-xs"}
        />
        <button
          disabled={pending || !text.trim()}
          onClick={() =>
            startTransition(async () => {
              await addMaterialCommentAction(material.id, trainingId, text);
              setText("");
            })
          }
          className="shrink-0 rounded-lg bg-brand-cyan px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-50"
        >
          Comentar
        </button>
      </div>
    </div>
  );
}

export function MaterialsSection({
  trainingId,
  materials,
  comments,
  people,
}: {
  trainingId: string;
  materials: Material[];
  comments: MaterialComment[];
  people: string[];
}) {
  const [adding, setAdding] = useState(false);
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState(createMaterialAction, null);
  const [, startTransition] = useTransition();

  const save = (id: string, field: string) => (value: string) =>
    updateMaterialField(id, trainingId, field, value);

  const toggleComments = (id: string) =>
    setOpenComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Materiales del proyecto ({materials.length})
        </h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg bg-brand-magenta px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-brand-magenta-dark"
        >
          {adding ? "Cancelar" : "+ Agregar material"}
        </button>
      </div>

      {adding && (
        <form
          action={(fd) => {
            formAction(fd);
            setAdding(false);
          }}
          className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-3"
        >
          <input type="hidden" name="training_id" value={trainingId} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Tipo</label>
            <select name="type" className={input}>
              {MATERIAL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Nombre *</label>
            <input name="name" required placeholder="Ej. PPT Sesión 1" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Link (Google Drive)</label>
            <input name="url" type="url" placeholder="https://drive.google.com/…" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Lo hace</label>
            <select name="maker" defaultValue={people.find((p) => p.includes("Oliver")) ?? ""} className={input}>
              <option value="">—</option>
              {people.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Lo revisa</label>
            <select name="reviewer" defaultValue={people.find((p) => p.includes("Arianna")) ?? ""} className={input}>
              <option value="">— (sin revisión)</option>
              {people.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Fecha límite</label>
            <input name="due_date" type="date" className={input} />
          </div>
          {state?.error && (
            <p className="sm:col-span-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-cyan px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-cyan-dark disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar material"}
            </button>
          </div>
        </form>
      )}

      {materials.length === 0 && !adding ? (
        <p className="p-6 text-center text-sm text-slate-400">
          Aquí viven las PPTs, manuales y demás materiales (links de Google Drive), con quién los hace y quién los revisa.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {materials.map((m) => {
            const mComments = comments.filter((c) => c.material_id === m.id);
            const flow =
              m.status === "Pendiente" || m.status === "En proceso"
                ? `${m.maker || "?"} lo prepara`
                : m.status === "Por revisar"
                  ? `en revisión de ${m.reviewer || "?"}`
                  : "aprobado";
            return (
              <li key={m.id} className="px-4 py-2.5 hover:bg-slate-50/40">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg" title={m.type}>{TYPE_ICON[m.type] ?? "📎"}</span>
                  <div className="min-w-40 flex-1">
                    <EditableField value={m.name} onSave={save(m.id, "name")} className="font-medium text-brand-navy" />
                    <p className="px-2 text-[11px] uppercase tracking-wide text-slate-400">
                      {m.type} · {flow}
                    </p>
                  </div>
                  <div className="min-w-52 flex-1">
                    {m.url ? (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1 text-xs font-semibold text-brand-cyan-dark transition hover:bg-brand-cyan/20"
                      >
                        Abrir en Drive
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    ) : (
                      <EditableField value={m.url} type="url" onSave={save(m.id, "url")} placeholder="Pega el link de Drive…" />
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-0.5">
                    <PersonSelect value={m.maker} people={people} placeholder="¿Quién lo hace?" onChange={save(m.id, "maker")} />
                    <PersonSelect value={m.reviewer} people={people} placeholder="¿Quién revisa?" onChange={save(m.id, "reviewer")} />
                  </div>
                  <div className="w-32 shrink-0">
                    <EditableField value={m.due_date ?? ""} type="date" onSave={save(m.id, "due_date")} />
                  </div>
                  <StatusSelect
                    value={m.status}
                    options={MATERIAL_STATUSES}
                    onChange={save(m.id, "status")}
                    small
                  />
                  <button
                    onClick={() => toggleComments(m.id)}
                    title="Comentarios"
                    className={`relative transition ${openComments.has(m.id) ? "text-brand-cyan-dark" : "text-slate-300 hover:text-brand-cyan-dark"}`}
                  >
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                    {mComments.length > 0 && (
                      <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-magenta px-1 text-[10px] font-bold text-white">
                        {mComments.length}
                      </span>
                    )}
                  </button>
                  <button
                    title="Eliminar material"
                    onClick={() => {
                      if (confirm(`¿Eliminar "${m.name}"?`)) {
                        startTransition(() => deleteMaterialAction(m.id, trainingId));
                      }
                    }}
                    className="text-slate-300 transition hover:text-red-500"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
                {openComments.has(m.id) && (
                  <div className="mt-2 pl-9">
                    <Comments material={m} trainingId={trainingId} comments={mComments} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
