import React, { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { createAppKit } from '@reown/appkit/react'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { bsc } from '@reown/appkit/networks'


const queryClient = new QueryClient()


const projectId = import.meta.env.VITE_REOWN_PROJECT_ID as string
if (!projectId) {
// Fail early for easier debugging
throw new Error('Missing VITE_REOWN_PROJECT_ID in environment')
}


// Networks — start with BSC only (you can add base, arbitrum, etc. later)
const networks = [bsc] as [AppKitNetwork, ...AppKitNetwork[]]


// Optional site metadata
const metadata = {
name: 'Yearn Staking — AppKit Starter',
description: 'Minimal connect → dashboard scaffold using Reown AppKit + Wagmi',
url:
(import.meta.env.VITE_PUBLIC_SITE_URL as string) ||
(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'),
icons: ['https://avatars.githubusercontent.com/u/179229932']
}


// Adapter for Wagmi
const wagmiAdapter = new WagmiAdapter({
projectId,
networks,
ssr: false,
// You can inject custom RPCs per chain id if you want to force a specific RPC
// transports: {
// [bsc.id]: http(import.meta.env.VITE_BSC_RPC_URL || 'https://bsc-dataseed1.bnbchain.org')
// }
})


// Create the AppKit modal once (outside React tree)
createAppKit({
adapters: [wagmiAdapter],
networks,
projectId,
metadata,
features: { analytics: true }
})


export function AppKitProvider({ children }: PropsWithChildren) {
return (
<WagmiProvider config={wagmiAdapter.wagmiConfig}>
<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
</WagmiProvider>
)
}
