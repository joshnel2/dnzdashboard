import { useState } from 'react'
import './AuthButton.css'

function AuthButton() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    try {
      // Get auth URL from our serverless function
      console.info('[CLIO][auth] Requesting OAuth URL...')
      const response = await fetch('/api/oauth/url')
      const data = await response.json()
      
      if (data.authUrl) {
        // Redirect to Clio authorization page
        console.info('[CLIO][auth] Redirecting to Clio authorize')
        window.location.href = data.authUrl
      } else {
        console.error('[CLIO][auth] Failed to get auth URL payload', data)
        setLoading(false)
      }
    } catch (error) {
      console.error('[CLIO][auth] Error initiating OAuth', error)
      setLoading(false)
    }
  }

  return (
    <div className="auth-button-container">
      <div className="auth-card">
        <h2>🔐 Connect to Clio</h2>
        <p>This dashboard needs to connect to your Clio account to display your firm's data.</p>
        <button 
          onClick={handleLogin} 
          disabled={loading}
          className="auth-button"
        >
          {loading ? 'Connecting...' : 'Connect to Clio'}
        </button>
        <p className="auth-note">
          You'll be redirected to Clio to authorize this application.
        </p>
      </div>
    </div>
  )
}

export default AuthButton
