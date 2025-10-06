import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppKitAccount } from '@reown/appkit/react'


export default function Dashboard() {
const navigate = useNavigate()
const { address, isConnected } = useAppKitAccount()


if (!isConnected) {
// Guard: if user disconnects, push them back to the welcome page
navigate('/')
}


return (
<div style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto' }}>
<header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
<h2 style={{ margin: 0 }}>Dashboard</h2>
{/** Reuse the same AppKit button (shows avatar, balance if connected) */}
<appkit-button balance="show"></appkit-button>
</header>


<section style={{ marginTop: 24 }}>
<p style={{ fontSize: 14, opacity: 0.8 }}>Connected address:</p>
<div style={{
padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 12,
fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas'
}}>
{address}
</div>


<p style={{ marginTop: 24, opacity: 0.7 }}>
From here we can gradually add cards for **Active Stakes**, **Packages**, etc.
</p>
</section>
</div>
)
}
