'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { validateEmail, validatePassword } from '../../../lib/auth';
import { useRedirectIfAuthed } from '../../../lib/useAuth';

export default function SignupPage() {
  useRedirectIfAuthed();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!validateEmail(email) || !validatePassword(password)) {
      setError('이메일 또는 비밀번호 형식을 확인해주세요 (비밀번호 8자 이상)');
      return;
    }
    setSubmitting(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      router.replace('/');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={handleSignup} className="flex w-full max-w-sm flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-2.5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-border bg-panel shadow-[4px_4px_0_var(--color-border)]">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--color-neon-cyan)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <h1 className="font-display text-center text-base leading-loose text-neon-cyan drop-shadow-[0_0_10px_rgba(46,230,255,0.6)]">
            ROADMAP
            <br />
            QUEST
          </h1>
        </div>

        <div className="flex w-full flex-col gap-3.5 rounded-2xl border-2 border-border bg-panel p-5 shadow-[5px_5px_0_var(--color-border)]">
          <p className="text-xs font-bold text-ink">회원가입</p>
          <input
            className="w-full rounded-lg border-2 border-border bg-field p-3 text-xs text-ink"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-lg border-2 border-border bg-field p-3 text-xs text-ink"
            placeholder="비밀번호 (8자 이상)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-xs text-neon-pink">{error}</p>}
          <button
            type="submit"
            className="mt-1 rounded-xl border-2 border-border bg-neon-pink p-3 font-display text-xs text-border shadow-[4px_4px_0_var(--color-border)] disabled:opacity-50"
            disabled={submitting}
          >
            가입하기
          </button>
        </div>

        <button type="button" className="text-xs text-neon-cyan underline" onClick={() => router.push('/login')}>
          이미 계정이 있으신가요? 로그인
        </button>
      </form>
    </div>
  );
}
