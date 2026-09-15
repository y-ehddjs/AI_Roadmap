import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 이미지에 .next 전체(개발 의존성 포함) 대신 실행에 필요한 파일만
  // .next/standalone으로 추려내기 위함 — Next.js 공식 컨테이너화 권장 설정.
  output: 'standalone',
};

export default nextConfig;
