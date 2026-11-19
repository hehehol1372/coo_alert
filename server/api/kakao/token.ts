// POST /api/kakao/token  { code, redirectUri } → 카카오 토큰
// client secret이 필요한 교환만 서버에서 한다. 토큰은 서버에 저장하지 않고 확장에 돌려준다.
import { checkInstallId, error, isExtensionRedirect, json, readJson, unexpected } from '../../lib/http.js'
import { exchangeCode, KakaoAuthError } from '../../lib/kakao.js'

export async function POST(req: Request): Promise<Response> {
  if (!checkInstallId(req)) return error(401, 'missing install id')
  const body = await readJson<{ code?: string; redirectUri?: string }>(req)
  if (!body?.code || !body.redirectUri || !isExtensionRedirect(body.redirectUri)) {
    return error(400, 'invalid body')
  }
  try {
    const t = await exchangeCode(body.code, body.redirectUri)
    return json({ refreshToken: t.refresh_token, refreshTokenExpiresIn: t.refresh_token_expires_in })
  } catch (e) {
    if (e instanceof KakaoAuthError) return error(401, e.message)
    return unexpected(e, 500, 'token exchange failed')
  }
}
