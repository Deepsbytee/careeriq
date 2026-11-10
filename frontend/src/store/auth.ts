import { create } from 'zustand'
import { api } from '../lib/api'

interface User {
  id: string
  email: string
  full_name: string
  role: string
}

interface AuthStore {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, full_name: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: false,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.access_token)
    set({ token: data.access_token })
    const me = await api.get('/auth/me')
    set({ user: me.data })
  },

  register: async (email, full_name, password) => {
    const { data } = await api.post('/auth/register', { email, full_name, password })
    localStorage.setItem('token', data.access_token)
    set({ token: data.access_token })
    const me = await api.get('/auth/me')
    set({ user: me.data })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null })
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me')
      set({ user: data })
    } catch {
      localStorage.removeItem('token')
      set({ user: null, token: null })
    }
  },
}))
