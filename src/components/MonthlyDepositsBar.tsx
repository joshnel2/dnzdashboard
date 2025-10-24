import './MonthlyDepositsBar.css'

interface MonthlyDepositsBarProps {
  amount: number
}

function MonthlyDepositsBar({ amount }: MonthlyDepositsBarProps) {
  console.log('📊 [MonthlyDepositsBar] Rendering with amount:', amount)
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const getMonthName = () => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months[new Date().getMonth()]
  }

  return (
    <div className="monthly-deposits">
      <div className="monthly-deposits-content">
        <div className="monthly-deposits-label">
          {getMonthName()} Deposits
        </div>
        <div className="monthly-deposits-amount">
          {formatCurrency(amount)}
        </div>
        <div className="monthly-deposits-subtitle">
          Total Monthly Revenue
        </div>
        <div className="monthly-deposits-icon">
          💰
        </div>
      </div>
    </div>
  )
}

export default MonthlyDepositsBar
