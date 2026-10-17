import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Lang, Profile } from './shared'

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  profile: Profile
  setProfile: (p: Profile) => void
}

const C = createContext<Ctx>(null!)

export function Provider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')
  const [profile, setProfile] = useState<Profile>('senior')
  return <C.Provider value={{ lang, setLang, profile, setProfile }}>{children}</C.Provider>
}

export const useApp = () => useContext(C)

export const PROFILE_LABEL: Record<Profile, string> = {
  senior: 'Senior (core)',
  adult: 'Adult',
  young_adult: 'Young adult (beta)',
  teen: 'Teen (beta)',
}
