import { ReactNode, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { Spinner } from '../ui'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, user, fetchMe } = useAuthStore()

  useEffect(() => {
    if (token && !user) fetchMe()
  }, [token, user, fetchMe])

  if (!token) return <Navigate to="/login" replace />
  if (token && !user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <Spinner size={32} />
    </div>
  )
  return <>{children}</>
}
