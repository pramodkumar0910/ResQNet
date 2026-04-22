// ResQNet Service Worker for Background Alerts
self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('ResQNet Service Worker: Installed');
});

self.addEventListener('activate', (event) => {
  console.log('ResQNet Service Worker: Activated');
});

// Listener for background notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Open the app when the notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('ResQNet') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
