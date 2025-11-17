// Service Worker - 기본 파일 (현재 비활성)
// 나중에 오프라인 기능이나 푸시 알림 추가 시 사용

self.addEventListener('install', (event) => {
  console.log('Service Worker 설치됨');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker 활성화됨');
});

self.addEventListener('fetch', (event) => {
  // 기본 네트워크 요청 사용 (캐싱 없음)
  return;
});
