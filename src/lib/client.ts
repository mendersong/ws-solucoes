"use client";

export type ApiResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
  queued?: boolean;
  [key: string]: unknown;
};

export type QueuedMutation = {
  id: string;
  path: string;
  method: string;
  body?: unknown;
  label: string;
  createdAt: number;
};

const QUEUE_KEY = "ws_offline_queue_v1";

export function readQueue(): QueuedMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedMutation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedMutation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent("ws-queue-updated", { detail: queue.length }));
}

export function enqueueMutation(mutation: Omit<QueuedMutation, "id" | "createdAt">) {
  const queue = readQueue();
  queue.push({
    ...mutation,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  });
  writeQueue(queue);
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { label?: string; queueIfOffline?: boolean } = {},
): Promise<ApiResult<T>> {
  const method = (init.method ?? "GET").toUpperCase();
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const canQueue = (init.queueIfOffline ?? true) && method !== "GET";
  const payload = init.body ? JSON.parse(String(init.body)) as unknown : undefined;

  if (offline && canQueue) {
    enqueueMutation({ path, method, body: payload, label: init.label ?? path });
    return { ok: true, queued: true, message: "Salvo no dispositivo. Sincroniza automaticamente quando a internet voltar." };
  }

  try {
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      cache: "no-store",
    });
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return { ok: false, error: String(json.error ?? `Erro ${response.status}`) };
    }
    return { ok: true, ...json } as ApiResult<T>;
  } catch {
    if (canQueue) {
      enqueueMutation({ path, method, body: payload, label: init.label ?? path });
      return {
        ok: true,
        queued: true,
        message: "Sem conexão: lançamento guardado no dispositivo e será sincronizado automaticamente.",
      };
    }
    return { ok: false, error: "Falha de conexão. Verifique sua internet e tente novamente." };
  }
}

export async function flushQueue(): Promise<{ synced: number; failed: number; remaining: number }> {
  const queue = readQueue();
  if (queue.length === 0) return { synced: 0, failed: 0, remaining: 0 };
  const remaining: QueuedMutation[] = [];
  let synced = 0;
  let failed = 0;
  for (const item of queue) {
    try {
      const response = await fetch(item.path, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });
      if (response.ok) {
        synced += 1;
      } else if (response.status >= 400 && response.status < 500) {
        failed += 1;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
  return { synced, failed, remaining: remaining.length };
}

export function queueCount(): number {
  return readQueue().length;
}
