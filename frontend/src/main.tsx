import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiAdapter } from './config/wagmi'
import App from './App'
import { SetupNotice } from './SetupNotice'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {wagmiAdapter ? (
      <WagmiProvider config={wagmiAdapter.wagmiConfig as any}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </WagmiProvider>
    ) : (
      <SetupNotice />
    )}
  </React.StrictMode>,
)
