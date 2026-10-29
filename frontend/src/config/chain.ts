import { defineChain } from '@reown/appkit/networks'

export const MST_CHAIN_ID = 91562037
export const MST_EXPLORER = 'https://testnet.mstscan.com'
export const MST_FAUCET = 'https://faucet.mstblockchain.com'

const rpc = import.meta.env.VITE_MST_RPC_URL || 'https://testnetrpc.mstblockchain.com'

export const mstTestnet = defineChain({
  id: MST_CHAIN_ID,
  caipNetworkId: `eip155:${MST_CHAIN_ID}`,
  chainNamespace: 'eip155',
  name: 'MST Testnet',
  nativeCurrency: { name: 'MST Coin', symbol: 'tMSTC', decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
  blockExplorers: { default: { name: 'MSTScan', url: MST_EXPLORER } },
  testnet: true,
})

export const explorerAddress = (a: string) => `${MST_EXPLORER}/address/${a}`
export const explorerTx = (h: string) => `${MST_EXPLORER}/tx/${h}`
