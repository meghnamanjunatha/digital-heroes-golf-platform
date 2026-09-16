import { useEffect, useState } from 'react'

const API_URL = 'http://127.0.0.1:8000'

async function apiRequest(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
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

function Dashboard({ navigate }) {
  const token = localStorage.getItem('access_token')
  const [plan, setPlan] = useState('monthly')
  const [subscriptionMessage, setSubscriptionMessage] = useState('')
  const [subscriptionError, setSubscriptionError] = useState('')
  const [charities, setCharities] = useState([])
  const [charitiesLoading, setCharitiesLoading] = useState(true)
  const [charityId, setCharityId] = useState('')
  const [percentage, setPercentage] = useState('10')
  const [charityMessage, setCharityMessage] = useState('')
  const [charityError, setCharityError] = useState('')
  const [scores, setScores] = useState([])
  const [scoresLoading, setScoresLoading] = useState(true)
  const [scoresError, setScoresError] = useState('')
  const [winners, setWinners] = useState([])
  const [winnersLoading, setWinnersLoading] = useState(true)
  const [winnersError, setWinnersError] = useState('')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    apiRequest('/charities', token)
      .then((data) => {
        setCharities(data)
        if (data.length > 0) setCharityId(String(data[0].id))
      })
      .catch((error) => setCharityError(error.message))
      .finally(() => setCharitiesLoading(false))

    apiRequest('/scores', token)
      .then(setScores)
      .catch((error) => setScoresError(error.message))
      .finally(() => setScoresLoading(false))

    apiRequest('/winners', token)
      .then(setWinners)
      .catch((error) => setWinnersError(error.message))
      .finally(() => setWinnersLoading(false))
  }, [token, navigate])

  async function refreshScores() {
    const data = await apiRequest('/scores', token)
    setScores(data)
  }

  async function handleSubscription(event) {
    event.preventDefault()
    setSubscriptionMessage('')
    setSubscriptionError('')
    try {
      await apiRequest('/subscriptions', token, {
        method: 'POST',
        body: JSON.stringify({ plan }),
      })
      setSubscriptionMessage('Subscription created successfully.')
    } catch (error) {
      setSubscriptionError(error.message)
    }
  }

  async function handleCharity(event) {
    event.preventDefault()
    setCharityMessage('')
    setCharityError('')
    try {
      await apiRequest('/charity-selection', token, {
        method: 'POST',
        body: JSON.stringify({
          charity_id: Number(charityId),
          charity_percentage: Number(percentage),
        }),
      })
      setCharityMessage('Charity selection saved.')
    } catch (error) {
      setCharityError(error.message)
    }
  }

  async function handleAddScore(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setScoresError('')
    try {
      await apiRequest('/scores', token, {
        method: 'POST',
        body: JSON.stringify({
          score: Number(form.get('score')),
          score_date: form.get('score_date'),
        }),
      })
      await refreshScores()
      formElement.reset()
    } catch (error) {
      setScoresError(error.message)
    }
  }

  async function handleDeleteScore(scoreId) {
    setScoresError('')
    try {
      await apiRequest(`/scores/${scoreId}`, token, { method: 'DELETE' })
      await refreshScores()
    } catch (error) {
      setScoresError(error.message)
    }
  }

  function handleLogout() {
    localStorage.removeItem('access_token')
    navigate('/login')
  }

  if (!token) return null

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <h1>Digital Heroes Dashboard</h1>
        <button type="button" onClick={handleLogout}>Logout</button>
      </header>

      <section className="dashboard-section">
        <h2>Subscription</h2>
        <form onSubmit={handleSubscription} className="dashboard-form">
          <label htmlFor="subscription-plan">Plan</label>
          <select id="subscription-plan" value={plan} onChange={(event) => setPlan(event.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <button type="submit">Subscribe</button>
        </form>
        {subscriptionMessage && <p className="notice" role="status">{subscriptionMessage}</p>}
        {subscriptionError && <p className="error" role="alert">{subscriptionError}</p>}
      </section>

      <section className="dashboard-section">
        <h2>Charity</h2>
        {charities.length > 0 ? (
          <form onSubmit={handleCharity} className="dashboard-form">
            <label htmlFor="charity-id">Choose a charity</label>
            <select id="charity-id" value={charityId} onChange={(event) => setCharityId(event.target.value)}>
              {charities.map((charity) => (
                <option key={charity.id} value={charity.id}>
                  {charity.name || `Charity #${charity.id}`}
                </option>
              ))}
            </select>
            <label htmlFor="charity-percentage">Contribution percentage</label>
            <input id="charity-percentage" type="number" min="10" max="100" step="0.01" value={percentage} onChange={(event) => setPercentage(event.target.value)} required />
            <button type="submit">Save charity</button>
          </form>
        ) : charitiesLoading ? <p>Loading charities...</p> : !charityError ? <p>No charities available.</p> : null}
        {charityMessage && <p className="notice" role="status">{charityMessage}</p>}
        {charityError && <p className="error" role="alert">{charityError}</p>}
      </section>

      <section className="dashboard-section">
        <h2>Scores</h2>
        <form onSubmit={handleAddScore} className="dashboard-form">
          <label htmlFor="score-value">Score</label>
          <input id="score-value" name="score" type="number" min="1" max="45" required />
          <label htmlFor="score-date">Date</label>
          <input id="score-date" name="score_date" type="date" required />
          <button type="submit">Add score</button>
        </form>
        {scoresError && <p className="error" role="alert">{scoresError}</p>}
        {scoresLoading ? <p>Loading scores...</p> : scores.length === 0 ? <p>No scores yet.</p> : (
          <ul className="dashboard-list">
            {scores.map((entry) => (
              <li key={entry.id}>
                <span>{entry.score_date}: {entry.score}</span>
                <button type="button" onClick={() => handleDeleteScore(entry.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashboard-section">
        <h2>Winnings</h2>
        {winnersError && <p className="error" role="alert">{winnersError}</p>}
        {winnersLoading ? <p>Loading winnings...</p> : winnersError ? null : winners.length === 0 ? <p>No winnings yet</p> : (
          <ul className="dashboard-list">
            {winners.map((winner) => (
              <li key={winner.id}>
                <span>{winner.match_count} matches · Prize: {winner.prize_amount} · Verification: {winner.verification_status} · Payment: {winner.payment_status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default Dashboard
