// POST /api/kakao/send  { text, refreshToken } → 나에게 보내기
// 하루 몇 번만 호출되므로 매번 refresh token으로 access token을 새로 받는다 (서버 무상태).
// 카카오가 새 refresh token을 주면 응답에 담아 확장이 교체 저장하게 한다.
import { checkInstallId, error, json, readJson, unexpected } from '../../lib/http.js'
import { KakaoAuthError, refresh, sendToMe } from '../../lib/kakao.js'

export async function POST(req: Request): Promise<Response> {
  if (!checkInstallId(req)) return error(401, 'missing install id')
  const body = await readJson<{ text?: string; refreshToken?: string }>(req)
  if (!body?.text || !body.refreshToken) return error(400, 'invalid body')

  const linkUrl = `${new URL(req.url).origin}/api/go`
  try {
    const t = await refresh(body.refreshToken)
    await sendToMe(t.access_token, body.text, linkUrl)
    return json({ ok: true, refreshToken: t.refresh_token ?? null })
  } catch (e) {
    // 401 → 확장이 "카카오 재로그인 필요"를 안내한다
    if (e instanceof KakaoAuthError) return error(401, 'kakao_reauth_required')
    return unexpected(e, 502, 'kakao send failed')
  }
}
