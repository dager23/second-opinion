import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAI, GoogleAIBackend } from 'firebase/ai'

const env = import.meta.env

export const firebaseConfigured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID)

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'missing',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'missing',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID || 'missing',
})

export let appCheck: ReturnType<typeof initializeAppCheck> | undefined

if (firebaseConfigured) {
  try {
    if (import.meta.env.DEV && env.VITE_APPCHECK_DEBUG_TOKEN) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN || true
    }
    if (env.VITE_RECAPTCHA_ENTERPRISE_KEY) {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_ENTERPRISE_KEY),
        isTokenAutoRefreshEnabled: true,
      })
    } else if (env.VITE_RECAPTCHA_SITE_KEY) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(env.VITE_RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      })
    }
  } catch (e) {
    console.warn('App Check init failed', e)
  }
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export const ai = getAI(app, { backend: new GoogleAIBackend() })

export const MODELS = {
  live: env.VITE_MODEL_LIVE || 'gemini-3.8-live',
  flash: env.VITE_MODEL_FLASH || 'gemini-3.8-flash',
  lite: env.VITE_MODEL_LITE || 'gemini-3.5-flash-lite',
}

let userPromise: Promise<User> | null = null
export function ensureUser(): Promise<User> {
  if (userPromise) return userPromise
  userPromise = new Promise<User>((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        unsub()
        resolve(u)
      }
    })
    signInAnonymously(auth).catch((e) => {
      userPromise = null
      reject(e)
    })
  })
  return userPromise
}
