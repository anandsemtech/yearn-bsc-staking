import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppKitAccount } from '@reown/appkit/react'


export default function Welcome() {
const navigate = useNavigate()
const { isConnected } = useAppKitAccount()


useEffect(() => {
if (isConnected) navigate('/dashboard')
}, [isConnected, navigate])


return (
<div style={{
minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24,
fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto'
}}>
<div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
<h1 style={{ fontSize: 28, marginBottom: 8 }}>Yearn Staking — Starter</h1>
<p style={{ opacity: 0.7, marginBottom: 20 }}>
Tap connect to continue. This page has no other wallet code — just AppKit.
</p>
{/** AppKit web component — globally available, no import needed */}
<appkit-button></appkit-button>
</div>
</div>
)
}
