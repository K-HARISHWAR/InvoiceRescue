export function MoneyDisplay({ 
  amount, 
  currency = "INR",
  className
}: { 
  amount: number, 
  currency?: string,
  className?: string
}) {
  // Use en-IN locale by default to get Indian number formatting (lakhs, crores)
  // If the currency is not INR, it might be better to use the default locale, 
  // but for a clean B2B look, we'll stick to a standard formatting.
  const locale = currency === 'INR' ? 'en-IN' : 'en-US'
  
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)

  return <span className={className}>{formatted}</span>
}
