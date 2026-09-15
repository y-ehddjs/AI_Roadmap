'use client';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

// getSupabaseConfig(process.env)로 객체 전체를 통째로 넘기면 안 된다 - Next.js가
// NEXT_PUBLIC_* 값을 클라이언트 번들에 정적으로 치환해주는 건 `process.env.KEY`처럼
// 리터럴로 직접 접근하는 지점뿐이라, 변수를 거쳐 넘긴 process.env는 브라우저에서
// 빈 값이 되어 여기서 "Missing NEXT_PUBLIC_SUPABASE_URL"로 항상 실패했다(실제
// dev 서버에서 재현 확인). 각 값을 리터럴 접근으로 꺼내 객체로 만들어 넘긴다.
const { url, anonKey } = getSupabaseConfig({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

export const supabase = createClient(url, anonKey);
