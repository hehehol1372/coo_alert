import { requireEnv } from './http.js'

export interface KakaoTokens {
  access_token: string
  expires_in: number
  refresh_token?: string // 갱신 시에는 만료가 가까울 때만 새로 내려온다
  refresh_token_expires_in?: number
}

export class KakaoAuthError extends Error {}

async function tokenRequest(params: Record<string, string>): Promise<KakaoTokens> {
  const body = new URLSearchParams({
    client_id: requireEnv('KAKAO_REST_API_KEY'),
    client_secret: requireEnv('KAKAO_CLIENT_SECRET'),
    ...params,
  })
  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  })
  const data = await res.json()
  if (!res.ok) throw new KakaoAuthError(data?.error_description ?? `kakao token ${res.status}`)
  return data as KakaoTokens
}

export function authorizeUrl(redirectUri: string): string {
  const q = new URLSearchParams({
    client_id: requireEnv('KAKAO_REST_API_KEY'),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'talk_message',
  })
  return `https://kauth.kakao.com/oauth/authorize?${q}`
}

export function exchangeCode(code: string, redirectUri: string) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
}

export function refresh(refreshToken: string) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

/** 카카오톡 나에게 보내기 (기본 텍스트 템플릿, 본문 최대 200자) */
export async function sendToMe(accessToken: string, text: string, linkUrl: string): Promise<void> {
  const template = {
    object_type: 'text',
    text: text.slice(0, 200),
    link: { web_url: linkUrl, mobile_web_url: linkUrl },
    button_title: '쿠팡 열기',
  }
  const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: new URLSearchParams({ template_object: JSON.stringify(template) }),
  })
  if (res.status === 401) throw new KakaoAuthError('kakao access token invalid')
  if (!res.ok) throw new Error(`kakao send ${res.status}: ${await res.text()}`)
}
