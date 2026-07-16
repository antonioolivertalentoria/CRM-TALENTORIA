/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Cliente Supabase simulado para el modo demostración.
 * Implementa el subconjunto de la API que usa esta app
 * (select/insert/update/delete con eq/not/order/limit/single)
 * sobre los datos en memoria de store.ts.
 */
import { getDemoStore, type DemoStore } from "./store";

export function isDemoMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return !url || url.includes("placeholder");
}

type Row = Record<string, any>;

const DEFAULTS: Record<string, Row> = {
  clients: { company: "", razon_social: "", rfc: "", contact_name: "", email: "", whatsapp: "", notes: "" },
  trainings: {
    official_name: "",
    status: "Propuesta",
    total_sessions: null,
    internal_owner: "",
    client_contact: "",
    client_email: "",
    whatsapp_group: "",
    temario_url: "",
    drive_folder_url: "",
    participants_url: "",
    materials_deadline: null,
    priority: "Media",
    envio_manual: "Pendiente",
    envio_constancias: "Pendiente",
    envio_insignias: "Pendiente",
    envio_dc3: "Pendiente",
    envio_leads: "Pendiente",
    encuesta_participantes: "Pendiente",
    encuesta_final: "Pendiente",
    factura: "Pendiente",
    seguimiento_20: "Pendiente",
    seguimiento_30: "Pendiente",
    mensaje_logistica: "Pendiente",
    logistics_info: "",
    notes: "",
    internal_notes: "",
    questions: "",
  },
  sessions: {
    session_number: 1,
    module: "",
    status: "Programada",
    session_date: null,
    start_time: null,
    end_time: null,
    duration_hours: null,
    facilitator: "",
    modality: "",
    platform: "",
    session_link: "",
    enrolled: null,
    attended: null,
    survey_status: "Pendiente",
    survey_url: "",
    survey_results_status: "Pendiente",
    survey_results_url: "",
    notes: "",
  },
  materials: { type: "Otro", name: "", url: "", status: "Pendiente", maker: "", reviewer: "", due_date: null },
  material_comments: { author: "", body: "" },
  profiles: { full_name: "", email: "" },
};

function compare(a: any, b: any): number {
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function resolveSelect(store: DemoStore, table: string, row: Row, sel: string): Row {
  const out: Row = { ...row };
  if (table === "trainings") {
    if (sel.includes("clients(")) {
      out.clients = store.clients.find((c) => c.id === row.client_id) ?? null;
    }
    if (sel.includes("sessions(")) {
      out.sessions = store.sessions.filter((s) => s.training_id === row.id);
    }
    if (sel.includes("materials(")) {
      out.materials = store.materials.filter((m) => m.training_id === row.id);
    }
  }
  if (table === "clients" && sel.includes("trainings(")) {
    out.trainings = store.trainings.filter((t) => t.client_id === row.id);
  }
  if (table === "sessions" && sel.includes("trainings(")) {
    const t = store.trainings.find((t) => t.id === row.training_id);
    out.trainings = t
      ? sel.includes("clients(")
        ? { ...t, clients: store.clients.find((c) => c.id === t.client_id) ?? null }
        : { ...t }
      : null;
  }
  return out;
}

function cascadeDelete(store: DemoStore, table: string, ids: Set<string>) {
  if (table === "clients") {
    const trainingIds = new Set(
      store.trainings.filter((t) => ids.has(t.client_id)).map((t) => t.id)
    );
    store.trainings = store.trainings.filter((t) => !ids.has(t.client_id));
    store.sessions = store.sessions.filter((s) => !trainingIds.has(s.training_id));
    store.materials = store.materials.filter((m) => !trainingIds.has(m.training_id));
  }
  if (table === "trainings") {
    store.sessions = store.sessions.filter((s) => !ids.has(s.training_id));
    store.materials = store.materials.filter((m) => !ids.has(m.training_id));
  }
}

class DemoQuery implements PromiseLike<{ data: any; error: any }> {
  private filters: ((r: Row) => boolean)[] = [];
  private orders: { field: string; asc: boolean }[] = [];
  private limitN?: number;
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private wantSingle = false;
  private maybe = false;
  private payload?: Row | Row[];
  private selectStr = "*";

  constructor(private table: keyof DemoStore) {}

  select(sel = "*") {
    this.selectStr = sel;
    return this;
  }
  eq(field: string, value: any) {
    this.filters.push((r) => String(r[field]) === String(value));
    return this;
  }
  not(field: string, op: string, value: any) {
    if (op === "is" && value === null) {
      this.filters.push((r) => r[field] !== null && r[field] !== undefined);
    }
    return this;
  }
  in(field: string, values: any[]) {
    const set = new Set(values.map(String));
    this.filters.push((r) => set.has(String(r[field])));
    return this;
  }
  order(field: string, opts?: { ascending?: boolean }) {
    this.orders.push({ field, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.wantSingle = true;
    return this;
  }
  maybeSingle() {
    this.wantSingle = true;
    this.maybe = true;
    return this;
  }
  insert(payload: Row | Row[]) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }

  then<T1 = any, T2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null
  ) {
    return Promise.resolve(this.exec()).then(onfulfilled, onrejected);
  }

  private exec(): { data: any; error: any } {
    const store = getDemoStore();
    const rows: Row[] = store[this.table] as Row[];
    const now = new Date().toISOString();

    if (this.mode === "insert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      const inserted = items.map((item) => ({
        id: crypto.randomUUID(),
        ...(DEFAULTS[this.table] ?? {}),
        ...item,
        created_at: now,
        updated_at: now,
      }));
      rows.push(...inserted);
      return this.finish(store, inserted);
    }

    if (this.mode === "update") {
      const matched = rows.filter((r) => this.filters.every((f) => f(r)));
      for (const r of matched) Object.assign(r, this.payload, { updated_at: now });
      return this.finish(store, matched);
    }

    if (this.mode === "delete") {
      const matched = rows.filter((r) => this.filters.every((f) => f(r)));
      const ids = new Set(matched.map((r) => r.id as string));
      (store as any)[this.table] = rows.filter((r) => !ids.has(r.id));
      cascadeDelete(store, this.table, ids);
      return { data: matched, error: null };
    }

    let result = rows.filter((r) => this.filters.every((f) => f(r)));
    for (const o of [...this.orders].reverse()) {
      result = [...result].sort(
        (a, b) => compare(a[o.field], b[o.field]) * (o.asc ? 1 : -1)
      );
    }
    if (this.limitN !== undefined) result = result.slice(0, this.limitN);
    return this.finish(store, result);
  }

  private finish(store: DemoStore, result: Row[]): { data: any; error: any } {
    const mapped = result.map((r) => resolveSelect(store, this.table, r, this.selectStr));
    if (this.wantSingle) {
      const first = mapped[0] ?? null;
      if (!first && !this.maybe) {
        return { data: null, error: { message: "No rows found (demo)" } };
      }
      return { data: first, error: null };
    }
    return { data: mapped, error: null };
  }
}

export function createDemoClient() {
  return {
    auth: {
      async getUser() {
        return {
          data: { user: { id: "demo-user", email: "demo@talentoria.com" } },
          error: null,
        };
      },
      async signInWithPassword() {
        return { data: {}, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
    from(table: string) {
      return new DemoQuery(table as keyof DemoStore);
    },
  };
}
