// GET /api/go → 쿠팡으로 리다이렉트
// 카카오 메시지 링크는 앱에 등록한 도메인만 허용되므로 우리 도메인을 한 번 거친다.
export function GET(): Response {
  return Response.redirect(process.env.COUPANG_URL || 'https://cart.coupang.com/cartView.pang', 302)
}
