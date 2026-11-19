// 공통 응답/검증 유틸

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

export function error(status: number, message: string): Response {
  return json({ error: message }, status)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 확장에서 보낸 설치 ID 확인 (최소한의 남용 방지) */
export function checkInstallId(req: Request): boolean {
  return UUID.test(req.headers.get('x-install-id') ?? '')
}

/** 본문 크기 제한을 두고 JSON 파싱 */
export async function readJson<T>(req: Request, maxBytes = 20_000): Promise<T | null> {
  const text = await req.text()
  if (text.length > maxBytes) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`환경변수 ${name}가 설정되지 않았습니다`)
  return v
}

/** 크롬 확장 identity API의 리다이렉트 주소만 허용 */
export function isExtensionRedirect(uri: string): boolean {
  return /^https:\/\/[a-p]{32}\.chromiumapp\.org\/?$/.test(uri)
}
