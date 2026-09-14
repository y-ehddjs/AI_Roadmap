self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? '로드맵 알림', {
      body: data.body ?? '',
    })
  );
});

// 브라우저가 내부적으로 구독을 갱신/만료시키면 이 이벤트가 발생한다. 서비스
// 워커에는 사용자의 로그인 세션이 없어 직접 Supabase에 쓸 수 없으므로, 새
// 구독을 열려있는 탭에 postMessage로 전달하고, 탭에 있는(로그인된) 클라이언트가
// 대신 저장하게 한다.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? { applicationServerKey: event.oldSubscription.options.applicationServerKey, userVisibleOnly: true } : undefined)
      .then((newSubscription) =>
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) =>
            client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription: newSubscription.toJSON() })
          );
        })
      )
  );
});
