'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { validateEmail, validatePassword } from '../../../lib/auth';
import { useRedirectIfAuthed } from '../../../lib/useAuth';

export default function LoginPage() {
  useRedirectIfAuthed();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!validateEmail(email) || !validatePassword(password)) {
      setError('이메일 또는 비밀번호 형식을 확인해주세요');
      return;
    }
    setSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.replace('/');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 p-6"
      onSubmit={handleLogin}
    >
      <h1 className="text-xl font-bold">로그인</h1>
      <input className="rounded-lg border p-3" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        className="rounded-lg border p-3"
        placeholder="비밀번호"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        className="rounded-lg bg-orange-500 p-3 font-semibold text-white disabled:opacity-50"
        disabled={submitting}
      >
        로그인
      </button>
      <button type="button" className="text-sm text-gray-500 underline" onClick={() => router.push('/signup')}>
        회원가입
      </button>
    </form>
  );
}
