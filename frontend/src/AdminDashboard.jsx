import { useEffect, useState } from 'react'
import { API_BASE_URL } from './api.js'

async function adminRequest(path, token, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  const result = await response.json().catch(() => ({}))

  if (!response.ok || result.error) {
    const message = result.error || result.detail
    throw new Error(typeof message === 'string' ? message : 'Request failed')
  }

  return result
}

function AdminDashboard({ navigate }) {
  const token = localStorage.getItem('access_token')
  const [draw, setDraw] = useState(null)
  const [drawMessage, setDrawMessage] = useState('')
  const [drawError, setDrawError] = useState('')
  const [drawBusy, setDrawBusy] = useState(false)
  const [winnerId, setWinnerId] = useState('')
  const [winnerMessage, setWinnerMessage] = useState('')
  const [winnerError, setWinnerError] = useState('')
  const [winnerStatus, setWinnerStatus] = useState('')
  const [winnerBusy, setWinnerBusy] = useState(false)

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  async function handleRunDraw() {
    setDraw(null)
    setDrawMessage('')
    setDrawError('')
    setDrawBusy(true)
    try {
      const result = await adminRequest('/draws/run', token, { method: 'POST' })
      setDraw(result)
      setDrawMessage('Draw completed successfully.')
    } catch (error) {
      setDrawError(error.message)
    } finally {
      setDrawBusy(false)
    }
  }

  async function handleWinnerAction(action) {
    const id = winnerId.trim()
    setWinnerMessage('')
    setWinnerError('')
    setWinnerStatus('')
    if (!id) {
      setWinnerError('Enter a winner ID.')
      return
    }

    setWinnerBusy(true)
    try {
      const paid = action === 'paid'
      const updatedWinner = await adminRequest(`/winners/${encodeURIComponent(id)}/${paid ? 'paid' : 'verify'}`, token, {
        method: 'PUT',
        ...(!paid ? { body: JSON.stringify({ status: action }) } : {}),
      })
      setWinnerMessage(paid ? 'Winner marked as paid.' : `Winner ${action}.`)
      setWinnerStatus(
        paid
          ? `Payment status: ${updatedWinner.payment_status}`
          : `Verification status: ${updatedWinner.verification_status}`
      )
    } catch (error) {
      setWinnerError(error.message)
    } finally {
      setWinnerBusy(false)
    }
  }

  if (!token) return null

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <a className="dashboard-link" href="/dashboard" onClick={(event) => { event.preventDefault(); navigate('/dashboard') }}>User dashboard</a>
      </header>

      <section className="dashboard-section">
        <h2>Run Draw</h2>
        <button type="button" onClick={handleRunDraw} disabled={drawBusy}>
          {drawBusy ? 'Running...' : 'Run Draw'}
        </button>
        {drawMessage && <p className="notice" role="status">{drawMessage}</p>}
        {drawError && <p className="error" role="alert">{drawError}</p>}
        {draw && (
          <dl className="draw-result">
            <dt>Draw ID</dt><dd>{draw.draw_id}</dd>
            <dt>Drawn numbers</dt><dd>{draw.numbers.join(', ')}</dd>
            <dt>Prize pool</dt><dd>{draw.prize_pool}</dd>
            <dt>Winners count</dt><dd>{draw.winners.length}</dd>
          </dl>
        )}
      </section>

      <section className="dashboard-section">
        <h2>Winners</h2>
        <div className="dashboard-form">
          <label htmlFor="admin-winner-id">Winner ID</label>
          <input id="admin-winner-id" type="text" value={winnerId} onChange={(event) => { setWinnerId(event.target.value); setWinnerStatus('') }} />
          <div className="dashboard-actions">
            <button type="button" onClick={() => handleWinnerAction('approved')} disabled={winnerBusy}>Approve winner</button>
            <button type="button" onClick={() => handleWinnerAction('rejected')} disabled={winnerBusy}>Reject winner</button>
            <button type="button" onClick={() => handleWinnerAction('paid')} disabled={winnerBusy}>Mark winner paid</button>
          </div>
        </div>
        {winnerMessage && <p className="notice" role="status">{winnerMessage}</p>}
        {winnerError && <p className="error" role="alert">{winnerError}</p>}
        {winnerStatus && <p role="status">{winnerStatus}</p>}
      </section>
    </main>
  )
}

export default AdminDashboard
