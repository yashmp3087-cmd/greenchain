import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { createAppKit } from '@reown/appkit/react'
import { mstTestnet } from './chain'

export const projectId = import.meta.env.VITE_REOWN_PROJECT_ID?.trim() || ''

/**
 * Wallet + social login.
 * - WalletConnect (BridgeKey, MetaMask, Rainbow, ...) and injected wallets via AppKit + wagmi.
 * - "Email & Social" (Google/Gmail) creates an embedded wallet. It must be switched on in the
 *   Reown dashboard for this project ID (Project → Features → Email & Socials).
 */
export const wagmiAdapter = projectId
  ? new WagmiAdapter({ networks: [mstTestnet], projectId, ssr: false })
  : null

if (wagmiAdapter && projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [mstTestnet],
    defaultNetwork: mstTestnet,
    projectId,
    metadata: {
      name: 'CarbonLedger',
      description: 'Verified tree carbon credits on MST Testnet',
      url: window.location.origin,
      icons: [],
    },
    features: { email: true, socials: ['google'], emailShowWallets: true, analytics: false },
    themeMode: 'light',
    themeVariables: { '--w3m-accent': '#2f6b4f', '--w3m-border-radius-master': '2px' },
  })
}
