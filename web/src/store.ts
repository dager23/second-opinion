import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db, ensureUser } from './firebase'
import type { Level, Profile, Signal } from './shared'

export interface Report {
  category: string
  summary: string
  caller_claims: string
  timeline: string[]
  quotes: string[]
  money_requested: string
  actions_taken: string[]
}

export interface SessionDoc {
  owner: string
  profile: Profile
  level: Level
  scamType: string
  guardianSummary: string
  holdStatus: 'none' | 'requested' | 'approved' | 'declined'
  holdReason: string
  report: Report | null
  createdAt?: unknown
}

export interface AlertDoc {
  at?: { seconds: number }
  level: Level
  scamType: string
  signals: Signal[]
  note: string
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function newCode(): string {
  const a = new Uint32Array(6)
  crypto.getRandomValues(a)
  return Array.from(a, (n) => ALPHABET[n % ALPHABET.length]).join('')
}

export async function createSession(profile: Profile): Promise<string> {
  const user = await ensureUser()
  const code = newCode()
  const data: SessionDoc = {
    owner: user.uid,
    profile,
    level: 'calm',
    scamType: 'none',
    guardianSummary: '',
    holdStatus: 'none',
    holdReason: '',
    report: null,
    createdAt: serverTimestamp(),
  }
  await setDoc(doc(db, 'sessions', code), data)
  return code
}

export async function updateSession(code: string, patch: Partial<SessionDoc>) {
  await updateDoc(doc(db, 'sessions', code), patch as Record<string, unknown>)
}

export async function pushAlert(code: string, a: Omit<AlertDoc, 'at'>) {
  await addDoc(collection(db, 'sessions', code, 'alerts'), { ...a, at: serverTimestamp() })
}

export async function sessionExists(code: string): Promise<boolean> {
  await ensureUser()
  const s = await getDoc(doc(db, 'sessions', code))
  return s.exists()
}

export function watchSession(code: string, cb: (s: SessionDoc | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'sessions', code),
    (s) => cb(s.exists() ? (s.data() as SessionDoc) : null),
    () => cb(null),
  )
}

export function watchAlerts(code: string, cb: (a: AlertDoc[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'sessions', code, 'alerts'),
    (snap) =>
      cb(
        snap.docs
          .map((d) => d.data() as AlertDoc)
          .sort((x, y) => (x.at?.seconds ?? 0) - (y.at?.seconds ?? 0)),
      ),
    () => cb([]),
  )
}

export async function decideHold(code: string, status: 'approved' | 'declined') {
  await ensureUser()
  await updateDoc(doc(db, 'sessions', code), { holdStatus: status })
}
