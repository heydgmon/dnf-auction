const API_BASE = "https://api.neople.co.kr";

export function getApiKey(): string {
  const key = process.env.NEOPLE_API_KEY;
  if (!key) throw new Error("NEOPLE_API_KEY not configured");
  return key;
}

export async function neopleGet(path: string, params?: Record<string, string>) {
  const apiKey = getApiKey();
  const parts: string[] = [];

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    });
  }
  parts.push(`apikey=${encodeURIComponent(apiKey)}`);

  const url = `${API_BASE}${path}?${parts.join("&")}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (status ${res.status})`);
  }

  return { data, status: res.status, ok: res.ok };
}

/** 쿼리 파라미터를 bracket notation 포함하여 raw로 전달 */
export async function neopleGetRaw(path: string, rawQuery: string) {
  const apiKey = getApiKey();
  const url = `${API_BASE}${path}?${rawQuery}&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (status ${res.status})`);
  }

  return { data, status: res.status, ok: res.ok };
}
