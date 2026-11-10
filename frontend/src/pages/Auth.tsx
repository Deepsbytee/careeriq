import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/auth'
import { errorMessage, fetchHealth } from '../lib/api'
import { Button, Input, Card } from '../components/ui'
import { MarketingLayout } from '../components/marketing/MarketingLayout'
import toast from 'react-hot-toast'
import { Zap, Mail, Lock, User, ArrowRight } from 'lucide-react'

function AuthCard({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-8">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-glow">
              <Zap size={18} className="text-white" />
            </div>
            <span className="font-bold text-xl">CareerIQ</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mb-2">{title}</h1>
          <p className="text-slate-400 text-sm">{subtitle}</p>
        </div>

        <Card padding="lg" className="gradient-border">
          {children}
        </Card>
      </motion.div>
    </div>
  )
}

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const [demoAvailable, setDemoAvailable] = useState(false)

  useEffect(() => { fetchHealth().then(h => setDemoAvailable(!!h?.demo_mode)) }, [])

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      toast.error(errorMessage(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  const loginDemo = async (role: string) => {
    const demoEmail = `${role}@example.com`
    const demoPassword = 'DemoPass123!'
    setEmail(demoEmail)
    setPassword(demoPassword)
    setLoading(true)
    try {
      await login(demoEmail, demoPassword)
      navigate('/dashboard')
    } catch (err) {
      toast.error(errorMessage(err, 'Demo login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <MarketingLayout>
      <AuthCard title="Welcome back" subtitle="Sign in to your CareerIQ account">
        <form onSubmit={handle} className="flex flex-col gap-5">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            icon={<Mail size={16} />}
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            icon={<Lock size={16} />}
          />
          <Button type="submit" loading={loading} fullWidth iconRight={<ArrowRight size={16} />}>
            Sign in
          </Button>
        </form>

        {demoAvailable && <div className="mt-6 pt-6 border-t border-ink/5">
          <p className="text-xs text-slate-500 text-center mb-4">Demo accounts are shared. Don't upload personal documents.</p>
          <div className="flex gap-2">
            {['candidate', 'recruiter', 'admin'].map(r => (
              <Button key={r} variant="secondary" size="sm" onClick={() => loginDemo(r)} disabled={loading} className="flex-1 capitalize">
                {r}
              </Button>
            ))}
          </div>
        </div>}

        <p className="text-center text-sm text-slate-400 mt-6">
          No account?{' '}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Create one
          </Link>
        </p>
      </AuthCard>
    </MarketingLayout>
  )
}

export function Register() {
  const [form, setForm] = useState({ email: '', full_name: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()
  const navigate = useNavigate()

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await register(form.email, form.full_name, form.password)
      navigate('/dashboard')
    } catch (err) {
      toast.error(errorMessage(err, 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <MarketingLayout>
      <AuthCard title="Create your account" subtitle="Get a scored review of your resume">
        <form onSubmit={handle} className="flex flex-col gap-5">
          <Input
            label="Full name"
            value={form.full_name}
            onChange={set('full_name')}
            required
            icon={<User size={16} />}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={set('email')}
            required
            icon={<Mail size={16} />}
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={set('password')}
            required
            hint="At least 8 characters"
            icon={<Lock size={16} />}
            minLength={8}
          />
          <Button type="submit" loading={loading} fullWidth iconRight={<ArrowRight size={16} />}>
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          Have an account?{' '}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign in
          </Link>
        </p>
      </AuthCard>
    </MarketingLayout>
  )
}
