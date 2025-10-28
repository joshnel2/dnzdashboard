import { useState } from 'react'
import './AuthButton.css'

function AuthButton() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    console.log('[AuthButton] Login button clicked');
    setLoading(true)
    try {
      console.log('[AuthButton] Fetching auth URL from /api/oauth/url');
      // Get auth URL from our serverless function
      const response = await fetch('/api/oauth/url')
      const data = await response.json()
      
      console.log('[AuthButton] Auth URL response:', data);
      
      if (data.authUrl) {
        console.log('[AuthButton] Redirecting to Clio authorization page:', data.authUrl);
        // Redirect to Clio authorization page
        window.location.href = data.authUrl
      } else {
        console.error('[AuthButton] Failed to get auth URL:', data)
        alert(`Failed to get auth URL: ${data.error || 'Unknown error'}`)
        setLoading(false)
      }
    } catch (error) {
      console.error('[AuthButton] Error initiating OAuth:', error)
      alert(`Error initiating OAuth: ${error}`)
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
