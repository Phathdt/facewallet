import '@rainbow-me/rainbowkit/styles.css'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { config } from '@/lib/wagmi/config'
import { AddressProvider } from '@/contexts/AddressContext'
import { PasskeyProvider } from '@/contexts/PasskeyContext'
import { BrowserCompatibility } from '@/components/BrowserCompatibility'
import { Home } from '@/pages/Home'
import { PRFTest } from '@/components/PRFTest'

const queryClient = new QueryClient()

function AppContent() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="bg-white p-6 shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Link to="/" className="text-2xl font-bold text-gray-900 hover:text-gray-700">
              FaceWallet
            </Link>
            <nav className="flex gap-6">
              <Link
                to="/"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Home
              </Link>
              <Link
                to="/prf-test"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                PRF Test
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-6">
          <BrowserCompatibility />

          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/prf-test" element={<PRFTest />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
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
