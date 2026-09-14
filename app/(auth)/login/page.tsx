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

  async function handleLogin() {
    if (!validateEmail(email) || !validatePassword(password)) {
      setError('이메일 또는 비밀번호 형식을 확인해주세요');
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace('/');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 p-6">
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
      <button className="rounded-lg bg-orange-500 p-3 font-semibold text-white" onClick={handleLogin}>
        로그인
      </button>
      <button className="text-sm text-gray-500 underline" onClick={() => router.push('/signup')}>
        회원가입
      </button>
    </div>
  );
}
