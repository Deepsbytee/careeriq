import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Download, Trash2, ShieldCheck } from 'lucide-react'
import { api, downloadFile, errorMessage } from '../lib/api'
import { useAuthStore } from '../store/auth'
import { Badge, Button, Card, Dialog, Input, PageHeader } from '../components/ui'
import { PageTransition } from '../components/layout/PageTransition'

const ROLE_LABEL: Record<string, string> = { candidate: 'Candidate', recruiter: 'Recruiter', admin: 'Admin' }

export default function Settings() {
  const { user, fetchMe, logout } = useAuthStore()
  const navigate = useNavigate()

  const [name, setName] = useState(user?.full_name || '')
  const [savingName, setSavingName] = useState(false)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const [exporting, setExporting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePw, setDeletePw] = useState('')
  const [deleting, setDeleting] = useState(false)

  const saveName = async () => {
    setSavingName(true)
    try {
      await api.patch('/auth/me', { full_name: name })
      await fetchMe()
      toast.success('Name updated')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update your name'))
    } finally {
      setSavingName(false)
    }
  }

  const changePassword = async () => {
    if (next !== confirm) return toast.error("The new passwords don't match.")
    setSavingPw(true)
    try {
      await api.post('/auth/change-password', { current_password: current, new_password: next })
      setCurrent(''); setNext(''); setConfirm('')
      toast.success('Password changed')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change your password'))
    } finally {
      setSavingPw(false)
    }
  }

  const exportData = async () => {
    setExporting(true)
    try {
      await downloadFile('/auth/me/export', 'careeriq-my-data.json')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not export your data'))
    } finally {
      setExporting(false)
    }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      await api.delete('/auth/me', { data: { password: deletePw } })
      logout()
      toast.success('Your account and data were deleted')
      navigate('/')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete your account'))
      setDeleting(false)
    }
  }

  return (
    <PageTransition>
      <PageHeader title="Settings" subtitle="Your account, your password, and your data." />

      <div className="max-w-2xl space-y-6">
        <Card padding="lg">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="text-lg font-semibold">Profile</h2>
            {user && <Badge variant="indigo">{ROLE_LABEL[user.role] ?? user.role}</Badge>}
          </div>
          <div className="space-y-4">
            <Input label="Full name" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Email" value={user?.email || ''} disabled hint="Your email can't be changed." />
            <Button onClick={saveName} loading={savingName} disabled={!name.trim() || name.trim() === user?.full_name}>
              Save name
            </Button>
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="text-lg font-semibold mb-5">Password</h2>
          <div className="space-y-4">
            <Input label="Current password" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
            <Input label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." value={next} onChange={e => setNext(e.target.value)} />
            <Input
              label="Confirm new password" type="password" autoComplete="new-password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              error={confirm && next !== confirm ? "Doesn't match" : undefined}
            />
            <Button variant="secondary" onClick={changePassword} loading={savingPw} disabled={!current || next.length < 8 || next !== confirm}>
              Change password
            </Button>
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-400" aria-hidden /> Your data</h2>
          <p className="text-sm text-slate-400 mb-5">
            Your resumes and analyses are private to your account. Download a copy of everything we store, or delete it all.
          </p>
          <Button variant="outline" icon={<Download size={15} />} loading={exporting} onClick={exportData}>
            Download my data
          </Button>
        </Card>

        <Card padding="lg" className="border-red-500/30">
          <h2 className="text-lg font-semibold mb-1 text-red-400">Delete account</h2>
          <p className="text-sm text-slate-400 mb-5">
            Permanently deletes your account, resumes, and every analysis. This can't be undone.
          </p>
          <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setDeleteOpen(true)}>Delete my account</Button>
        </Card>
      </div>

      <Dialog
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeletePw('') }}
        title="Delete your account?"
        description="Enter your password to confirm. Everything will be removed immediately."
        confirmLabel={deleting ? 'Deleting...' : 'Delete everything'}
        variant="danger"
        onConfirm={deletePw && !deleting ? deleteAccount : undefined}
      >
        <div className="mt-4">
          <Input label="Password" type="password" autoComplete="current-password" value={deletePw} onChange={e => setDeletePw(e.target.value)} />
        </div>
      </Dialog>
    </PageTransition>
  )
}
