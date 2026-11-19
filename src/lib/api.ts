import { SERVER_URL } from './config'
import { getInstallId, getKey } from './storage'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Install-Id': await getInstallId() },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(res.status, `${path} ${res.status}`)
  return (await res.json()) as T
}

interface KakaoStore {
  refreshToken: string
  connectedAt: number
}

export async function isKakaoConnected(): Promise<boolean> {
  return !!(await getKey<KakaoStore>('kakao'))?.refreshToken
}

/** 카카오 로그인 → refresh token을 chrome.storage.local에 저장 (서버에는 저장하지 않음) */
export async function connectKakao(): Promise<void> {
  const redirectUri = chrome.identity.getRedirectURL() // https://<확장ID>.chromiumapp.org/
  const resultUrl = await chrome.identity.launchWebAuthFlow({
    url: `${SERVER_URL}/api/kakao/login?redirect_uri=${encodeURIComponent(redirectUri)}`,
    interactive: true,
  })
  const code = resultUrl ? new URL(resultUrl).searchParams.get('code') : null
  if (!code) throw new Error('카카오 로그인이 취소됐어요.')
  const { refreshToken } = await post<{ refreshToken: string }>('/api/kakao/token', { code, redirectUri })
  await chrome.storage.local.set({ kakao: { refreshToken, connectedAt: Date.now() } satisfies KakaoStore })
}

export async function disconnectKakao(): Promise<void> {
  await chrome.storage.local.remove('kakao')
}

/** 카카오톡 '나에게 보내기'. 실패 시 예외 → 호출 측에서 크롬 알림으로 대체한다. */
export async function sendKakao(text: string): Promise<void> {
  const kakao = await getKey<KakaoStore>('kakao')
  if (!kakao?.refreshToken) throw new Error('kakao not connected')
  try {
    const res = await post<{ ok: boolean; refreshToken: string | null }>('/api/kakao/send', {
      text,
      refreshToken: kakao.refreshToken,
    })
    // 카카오가 refresh token을 새로 발급하면 교체 저장
    if (res.refreshToken) await chrome.storage.local.set({ kakao: { ...kakao, refreshToken: res.refreshToken } })
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      await disconnectKakao()
      throw new Error('kakao_reauth_required')
    }
    throw e
  }
}
