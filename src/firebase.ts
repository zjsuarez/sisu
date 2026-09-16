import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, browserPopupRedirectResolver, connectAuthEmulator, GoogleAuthProvider, initializeAuth, signInWithCredential } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const emulators = import.meta.env.VITE_EMULATORS === 'true'
const local = ['localhost', '127.0.0.1'].includes(location.hostname)

// Shared with the schedule app (see FIREBASE_SCHEMA.md). The web config is public by design:
// Firestore security rules protect the data, not these values.
const config = emulators
  ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-sisu', appId: 'demo-app' }
  : {
      apiKey: 'AIzaSyAhsVkdgnuEf4WS91xN9UC1qs1Yb86_bBU',
      // Deployed: serve the auth handler from our own domain (vercel.json proxies /__/auth),
      // which makes redirect sign-in first-party. Safari and iOS home-screen apps require that.
      authDomain: local ? 'scheduleproject-8f615.firebaseapp.com' : location.hostname,
      projectId: 'scheduleproject-8f615',
      messagingSenderId: '672306369436',
      appId: '1:672306369436:web:10176a07f16bc0cab72e59',
    }

const app = initializeApp(config)

// localStorage persistence, same as the schedule app: IndexedDB can close while the Google popup has focus.
export const auth = initializeAuth(app, { persistence: browserLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver })

// Offline-first: every read and write goes through a persistent IndexedDB cache.
// Writes made offline are queued there and sent the next time the app is open with a connection.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (emulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  // ponytail: test hook, emulator builds only. The auth emulator accepts an unsigned Google credential,
  // so end-to-end tests can sign in without driving Google's real consent screen.
  Object.assign(window, {
    __signIn: (email = 'athlete@sisu.test', sub = 'test-athlete') =>
      signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true, name: 'Test Athlete' }))),
  })
}
