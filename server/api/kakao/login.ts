// GET /api/kakao/login?redirect_uri=https://<확장ID>.chromiumapp.org/
// 확장의 chrome.identity.launchWebAuthFlow가 이 주소로 시작한다.
// REST API 키를 확장 코드에 넣지 않기 위해 서버가 카카오 인가 페이지로 넘겨준다.
import { authorizeUrl } from '../../lib/kakao.js'
import { error, isExtensionRedirect, unexpected } from '../../lib/http.js'

export function GET(req: Request): Response {
  const redirectUri = new URL(req.url).searchParams.get('redirect_uri') ?? ''
  if (!isExtensionRedirect(redirectUri)) return error(400, 'invalid redirect_uri')
  try {
    return Response.redirect(authorizeUrl(redirectUri), 302)
  } catch (e) {
    return unexpected(e)
  }
}
