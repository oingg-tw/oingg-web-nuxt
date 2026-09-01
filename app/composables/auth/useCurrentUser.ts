import type { User } from 'firebase/auth'

export function useCurrentUser() {
  return useState<User | null>('firebase-current-user', () => null)
}
