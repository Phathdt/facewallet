import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useAddress } from '@/hooks/useAddress'
import { AccountDisplay } from '@/components/AccountDisplay'
import { PasskeyManager } from '@/components/PasskeyManager'
import { SignMessage } from '@/components/SignMessage'
import { ManualAddressInput } from '@/components/ManualAddressInput'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function Home() {
  const { activeAddress, mode, setMode, addressState } = useAddress()
  const { isConnected } = useAccount()

  return (
    <>
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
              {mode === 'manual' && isConnected && (
                <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-800">
                    You have a wallet connected. Switch to "Connect Wallet" tab
                    to use it.
                  </p>
                </div>
              )}

              {mode === 'wallet' && !isConnected && addressState.address && (
                <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-800">
                    You have a manual address saved. Switch to "Manual Address"
                    tab to use it.
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
    </>
  )
}
