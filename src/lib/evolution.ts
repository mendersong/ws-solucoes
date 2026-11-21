export type EvolutionConfig = {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
};

export class EvolutionError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function phoneDigits(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

async function request<T>(
  config: EvolutionConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${normalizeBaseUrl(config.baseUrl)}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (error) {
    throw new EvolutionError(
      `Não foi possível alcançar o servidor da Evolution API em ${normalizeBaseUrl(config.baseUrl)}. Verifique a URL, se o servidor está online e se permite requisições externas. (${(error as Error).message})`,
      502,
    );
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message =
      (data as { message?: string; error?: string })?.message ??
      (data as { error?: string })?.error ??
      `Evolution API respondeu ${response.status}`;
    throw new EvolutionError(String(message), response.status);
  }
  return data as T;
}

export type ConnectionState = {
  state: "open" | "connecting" | "close" | "unknown";
  statusLabel: string;
};

export async function fetchConnectionState(config: EvolutionConfig): Promise<ConnectionState> {
  const data = await request<{ instance?: { state?: string } }>(
    config,
    `/instance/connectionState/${encodeURIComponent(config.instanceName)}`,
    { method: "GET" },
  );
  const raw = data?.instance?.state ?? "unknown";
  const state = raw === "open" || raw === "connecting" || raw === "close" ? raw : "unknown";
  return {
    state,
    statusLabel: state === "open" ? "conectado" : state === "connecting" ? "aguardando" : "desconectado",
  };
}

export type ConnectResult = {
  qrCode: string | null;
  pairingCode: string | null;
  raw: unknown;
};

export async function connectInstance(config: EvolutionConfig): Promise<ConnectResult> {
  try {
    const state = await fetchConnectionState(config);
    if (state.state === "open") return { qrCode: null, pairingCode: null, raw: { alreadyConnected: true } };
  } catch {
    // instance may not exist yet — try to create it below
    try {
      await request(config, "/instance/create", {
        method: "POST",
        body: JSON.stringify({
          instanceName: config.instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });
    } catch {
      // if creation fails because it exists, continue to the connect call
    }
  }
  const data = await request<{ base64?: string; code?: string; pairingCode?: string; qrcode?: { base64?: string; code?: string } }>(
    config,
    `/instance/connect/${encodeURIComponent(config.instanceName)}`,
    { method: "GET" },
  );
  const qrCode = data?.base64 ?? data?.qrcode?.base64 ?? data?.code ?? data?.qrcode?.code ?? null;
  const pairingCode = data?.pairingCode ?? null;
  return { qrCode, pairingCode, raw: data };
}

export async function sendText(config: EvolutionConfig, number: string, text: string) {
  const digits = phoneDigits(number);
  if (!digits) throw new EvolutionError("Número de destino inválido.", 400);
  return request<unknown>(config, `/message/sendText/${encodeURIComponent(config.instanceName)}`, {
    method: "POST",
    body: JSON.stringify({ number: digits, text, delay: 1200 }),
  });
}

export async function sendMedia(
  config: EvolutionConfig,
  number: string,
  input: { mediaUrl: string; fileName?: string; caption?: string; mediaType?: "document" | "image" },
) {
  const digits = phoneDigits(number);
  if (!digits) throw new EvolutionError("Número de destino inválido.", 400);
  return request<unknown>(config, `/message/sendMedia/${encodeURIComponent(config.instanceName)}`, {
    method: "POST",
    body: JSON.stringify({
      number: digits,
      mediatype: input.mediaType ?? "document",
      mimetype: "application/pdf",
      caption: input.caption ?? "",
      fileName: input.fileName ?? "documento.pdf",
      media: input.mediaUrl,
    }),
  });
}

export async function setWebhook(config: EvolutionConfig, webhookUrl: string, secret?: string | null) {
  return request<unknown>(config, `/webhook/set/${encodeURIComponent(config.instanceName)}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        ...(secret ? { headers: { "x-ws-secret": secret } } : {}),
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED", "SEND_MESSAGE"],
        byEvents: false,
        base64: true,
      },
    }),
  });
}

export async function logoutInstance(config: EvolutionConfig) {
  return request<unknown>(config, `/instance/logout/${encodeURIComponent(config.instanceName)}`, { method: "DELETE" });
}

export async function fetchInstances(config: EvolutionConfig) {
  return request<unknown>(config, "/instance/fetchInstances", { method: "GET" });
}

export function extractMessageText(message: Record<string, unknown> | undefined): string {
  if (!message) return "";
  const conversation = message.conversation;
  if (typeof conversation === "string") return conversation;
  const extended = message.extendedTextMessage as { text?: string } | undefined;
  if (extended?.text) return extended.text;
  const image = message.imageMessage as { caption?: string } | undefined;
  if (image?.caption) return image.caption;
  const video = message.videoMessage as { caption?: string } | undefined;
  if (video?.caption) return video.caption;
  return "";
}
