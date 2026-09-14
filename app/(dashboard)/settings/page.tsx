'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { subscribeToPush } from '../../../lib/notifications';
import type { NotificationSettings } from '../../../types/models';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string;

export default function SettingsPage() {
  const userId = useRequireAuth();
  const router = useRouter();
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    // Task 2의 트리거가 가입 시점에 기본 행을 이미 만들어뒀으므로, 여기서는
    // 그 값을 읽어와 체크박스/시간 입력을 실제 DB 상태와 맞춘다(이전 버전은
    // 항상 켜진 상태로 시작해 새로고침하면 꺼둔 설정이 다시 켜진 것처럼 보였다).
    supabase
      .from('notification_settings')
      .select('reminder_enabled, reminder_time')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        const settings = data as Pick<NotificationSettings, 'reminder_enabled' | 'reminder_time'> | null;
        if (!settings) return;
        setReminderEnabled(settings.reminder_enabled);
        setReminderTime(settings.reminder_time.slice(0, 5));
        setLoaded(true);
      });
  }, [userId]);

  // "계정" 카드에 표시할 이메일 — profiles/notification_settings 어디에도 없고
  // auth.users에만 있는 값이라, 이 화면에서만 필요한 별도 조회로 가져온다
  // (useRequireAuth는 userId만 반환하고, 다른 태스크들도 그 계약에 기대고 있어
  // 여기서 굳이 리턴 타입을 바꾸지 않는다).
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function toggleReminder(value: boolean) {
    setReminderEnabled(value);
    if (!userId) return;
    const subscription = value ? await subscribeToPush(VAPID_PUBLIC_KEY) : null;
    await supabase
      .from('notification_settings')
      .upsert(
        { user_id: userId, reminder_enabled: value, push_subscription: subscription },
        { onConflict: 'user_id' }
      );
  }

  async function handleReminderTimeChange(value: string) {
    setReminderTime(value);
    if (!userId) return;
    await supabase
      .from('notification_settings')
      .upsert({ user_id: userId, reminder_time: value }, { onConflict: 'user_id' });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (!loaded) return null;

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-bold">설정</h1>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={reminderEnabled} onChange={(e) => toggleReminder(e.target.checked)} />
        알림 받기
      </label>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600" htmlFor="reminder-time">
          알림 시간
        </label>
        <input
          id="reminder-time"
          type="time"
          className="rounded-lg border p-2"
          value={reminderTime}
          disabled={!reminderEnabled}
          onChange={(e) => handleReminderTimeChange(e.target.value)}
        />
      </div>
      {email && <p className="text-sm text-gray-500">{email}</p>}
      <button className="rounded-lg border px-4 py-2" onClick={handleLogout}>
        로그아웃
      </button>
    </div>
  );
}
