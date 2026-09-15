import { NextResponse } from 'next/server';

// 이 라우트는 서버(Node) 사이드에서만 실행되므로 INTERNAL_API_SECRET이 브라우저로
// 절대 안 나간다 — "지금 확인하기" 버튼은 이 라우트를 부르고, 이 라우트가 대신
// 백엔드의 시크릿 보호 엔드포인트를 호출한다.
export async function POST() {
  const backendUrl = process.env.BACKEND_URL;
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!backendUrl || !internalSecret) {
    return NextResponse.json({ error: 'BACKEND_URL 또는 INTERNAL_API_SECRET이 설정되지 않았어요.' }, { status: 500 });
  }

  const response = await fetch(`${backendUrl}/internal/check-coaching`, {
    method: 'POST',
    headers: { 'X-Internal-Secret': internalSecret },
  });
  const data = await response.json().catch(() => null);
  return NextResponse.json(data, { status: response.status });
}
