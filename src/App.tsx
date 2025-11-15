import '@rainbow-me/rainbowkit/styles.css'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { WagmiProvider, useAccount } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { config } from '@/lib/wagmi/config'
import { AddressProvider, useAddress } from '@/contexts/AddressContext'
import { PasskeyProvider } from '@/contexts/PasskeyContext'
import { BrowserCompatibility } from '@/components/BrowserCompatibility'
import { AccountDisplay } from '@/components/AccountDisplay'
import { PasskeyManager } from '@/components/PasskeyManager'
import { SignMessage } from '@/components/SignMessage'
import { ManualAddressInput } from '@/components/ManualAddressInput'
import { DebugInfo } from '@/components/DebugInfo'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const queryClient = new QueryClient()

function AppContent() {
  const { activeAddress, mode, setMode, addressState } = useAddress()
  const { isConnected } = useAccount()

  useEffect(() => {
    console.log('=== App Environment Check ===')
    console.log('All env vars:', import.meta.env)
    console.log('VITE_RP_ID:', import.meta.env.VITE_RP_ID)
    console.log('VITE_RP_NAME:', import.meta.env.VITE_RP_NAME)
    console.log('MODE:', import.meta.env.MODE)
    console.log('DEV:', import.meta.env.DEV)
    console.log('PROD:', import.meta.env.PROD)
    console.log('============================')
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <DebugInfo />
      <header className="bg-white p-6 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">FaceWallet</h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">
        <BrowserCompatibility />

        {activeAddress ? (
          <div className="mt-6 space-y-6">
            <AccountDisplay />
            <PasskeyManager />
            <SignMessage />
          </div>
        ) : (
          <div className="py-20">
            <div className="mx-auto max-w-2xl">
              <div className="mb-12 text-center">
                <h2 className="mb-4 text-3xl font-bold text-gray-900">
                  Welcome to FaceWallet
                </h2>
                <p className="text-lg text-gray-600">
                  Connect your wallet or enter an address to get started, then
                  create a passkey for biometric signing
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                {/* Show helpful message when wallet is connected but manual mode selected */}
                {mode === 'manual' && isConnected && (
                  <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
                    <p className="text-sm text-blue-800">
                      You have a wallet connected. Switch to "Connect Wallet"
                      tab to use it.
                    </p>
                  </div>
                )}

                {/* Show helpful message when manual address exists but wallet mode selected */}
                {mode === 'wallet' && !isConnected && addressState.address && (
                  <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
                    <p className="text-sm text-blue-800">
                      You have a manual address saved. Switch to "Manual
                      Address" tab to use it.
                    </p>
                  </div>
                )}

                <Tabs
                  value={mode}
                  onValueChange={value => setMode(value as 'wallet' | 'manual')}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="wallet">Connect Wallet</TabsTrigger>
                    <TabsTrigger value="manual">Manual Address</TabsTrigger>
                  </TabsList>

                  <TabsContent value="wallet" className="mt-6">
                    <div className="text-center">
                      <h3 className="mb-2 text-lg font-semibold text-gray-900">
                        Connect Your Wallet
                      </h3>
                      <p className="mb-4 text-sm text-gray-600">
                        Connect your Web3 wallet to access all features
                      </p>
                      <div className="flex justify-center">
                        <ConnectButton />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="manual" className="mt-6">
                    <div>
                      <h3 className="mb-2 text-center text-lg font-semibold text-gray-900">
                        Enter Manual Address
                      </h3>
                      <p className="mb-4 text-center text-sm text-gray-600">
                        Enter an Ethereum address to use passkey signing
                      </p>
                      <ManualAddressInput />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <RainbowKitProvider>
          <AddressProvider>
            <PasskeyProvider>
              <AppContent />
            </PasskeyProvider>
          </AddressProvider>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
