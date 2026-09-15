'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useRequireAuth } from '../../../lib/useAuth';
import { subscribeToPush } from '../../../lib/notifications';
import { getProfile, updateProfile } from '../../../lib/profiles';
import type { NotificationSettings } from '../../../types/models';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string;

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border-2 border-border transition-colors ${
        checked ? 'bg-neon-cyan' : 'bg-field'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-panel transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const userId = useRequireAuth();
  const router = useRouter();
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(false);

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
      .then(async ({ data }) => {
        const settings = data as Pick<NotificationSettings, 'reminder_enabled' | 'reminder_time'> | null;
        if (settings) {
          setReminderEnabled(settings.reminder_enabled);
          setReminderTime(settings.reminder_time.slice(0, 5));
        }
        const profile = await getProfile(supabase, userId as string);
        setDisplayName(profile.display_name);
        setShowOnLeaderboard(profile.show_on_leaderboard);
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

  async function handleDisplayNameChange(value: string) {
    setDisplayName(value);
    if (!userId) return;
    await updateProfile(supabase, userId, { display_name: value });
  }

  async function handleShowOnLeaderboardChange(value: boolean) {
    setShowOnLeaderboard(value);
    if (!userId) return;
    await updateProfile(supabase, userId, { show_on_leaderboard: value });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (!loaded) return null;

  return (
    <div className="mx-auto max-w-md space-y-3 p-6">
      <h1 className="font-display text-sm text-neon-cyan drop-shadow-[0_0_8px_rgba(46,230,255,0.5)]">설정</h1>

      <div className="flex flex-col gap-3 rounded-2xl border-2 border-border bg-panel p-4 shadow-[4px_4px_0_var(--color-border)]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-ink">알림 받기</span>
          <Toggle checked={reminderEnabled} onChange={toggleReminder} />
        </div>
        <div className="flex items-center justify-between">
          <label className="text-xs text-ink-dim" htmlFor="reminder-time">
            알림 시간
          </label>
          <input
            id="reminder-time"
            type="time"
            className="rounded-md border-2 border-border bg-field p-1.5 text-xs text-ink disabled:opacity-50"
            value={reminderTime}
            disabled={!reminderEnabled}
            onChange={(e) => handleReminderTimeChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border-2 border-border bg-panel p-4 shadow-[4px_4px_0_var(--color-border)]">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-ink-dim" htmlFor="display-name">
            닉네임 (리더보드/공개 화면에 표시)
          </label>
          <input
            id="display-name"
            className="rounded-lg border-2 border-border bg-field p-2 text-xs text-ink"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-ink">리더보드에 표시</span>
          <Toggle checked={showOnLeaderboard} onChange={handleShowOnLeaderboardChange} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border-2 border-border bg-panel p-4 shadow-[4px_4px_0_var(--color-border)]">
        {email && <p className="text-xs text-ink-dim">{email}</p>}
        <button
          className="rounded-lg border-2 border-neon-red bg-panel py-2 text-xs font-bold text-neon-red"
          onClick={handleLogout}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
