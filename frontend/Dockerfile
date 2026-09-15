# 1) deps — package-lock.json 기준으로 의존성만 먼저 설치해 소스 변경 시에도
#    npm ci 레이어가 캐시되게 분리한다.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2) builder — NEXT_PUBLIC_* 값은 클라이언트 번들에 빌드 시점에 정적으로
#    박히므로(런타임에 주입 불가), 빌드 인자로 받아 빌드 전에 ENV로 넣어준다.
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

RUN npm run build

# 3) runner — next.config.ts의 output:'standalone'이 실행에 꼭 필요한 파일만
#    .next/standalone에 추려주므로, node_modules 전체 대신 그것만 옮겨
#    이미지를 가볍게 유지한다. 정적 파일(.next/static)과 public/은 standalone
#    출력물에 포함되지 않아 따로 복사해야 한다.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
