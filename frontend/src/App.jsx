import { useEffect, useState } from 'react'
import AdminDashboard from './AdminDashboard.jsx'
import Dashboard from './Dashboard.jsx'
import { API_BASE_URL } from './api.js'
import './App.css'

async function postAuth(path, details) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(details),
  })
  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(typeof result.detail === 'string' ? result.detail : 'Request failed')
  }

  return result
}

function LoginPage({ navigate, notice }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const form = new FormData(event.currentTarget)
    try {
      const result = await postAuth('/login', {
        email: form.get('email'),
        password: form.get('password'),
      })
      if (!result.access_token) {
        throw new Error('Login did not return an access token')
      }
      localStorage.setItem('access_token', result.access_token)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-card">
      <h1>Login</h1>
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="login-email">Email</label>
        <input id="login-email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="login-password">Password</label>
        <input id="login-password" name="password" type="password" autoComplete="current-password" required />
        <button type="submit" disabled={submitting}>{submitting ? 'Logging in...' : 'Login'}</button>
      </form>
      <p>New here? <a href="/signup" onClick={(event) => { event.preventDefault(); navigate('/signup') }}>Sign up</a></p>
    </main>
  )
}

function SignupPage({ navigate, onSuccess }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const form = new FormData(event.currentTarget)
    try {
      await postAuth('/signup', {
        full_name: form.get('full_name'),
        email: form.get('email'),
        password: form.get('password'),
      })
      onSuccess('Account created. Please log in.')
      navigate('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-card">
      <h1>Sign up</h1>
      {error && <p className="error" role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="signup-name">Full name</label>
        <input id="signup-name" name="full_name" type="text" autoComplete="name" required />
        <label htmlFor="signup-email">Email</label>
        <input id="signup-email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="signup-password">Password</label>
        <input id="signup-password" name="password" type="password" autoComplete="new-password" required />
        <button type="submit" disabled={submitting}>{submitting ? 'Signing up...' : 'Signup'}</button>
      </form>
      <p>Already have an account? <a href="/login" onClick={(event) => { event.preventDefault(); navigate('/login') }}>Login</a></p>
    </main>
  )
}

function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function navigate(nextPath) {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
  }

  if (path === '/dashboard') {
    return <Dashboard navigate={navigate} />
  }

  if (path === '/admin') {
    return <AdminDashboard navigate={navigate} />
  }

  if (path === '/signup') {
    return <SignupPage navigate={navigate} onSuccess={setNotice} />
  }

  return <LoginPage navigate={navigate} notice={notice} />
}

export default App
