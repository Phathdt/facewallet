import { useState } from 'react'
import { useSignMessage } from 'wagmi'
import { Button } from '@/components/ui/button'
import { AlertCircle, Info } from 'lucide-react'
import { useAddress } from '@/contexts/AddressContext'
import { usePasskey } from '@/contexts/PasskeyContext'

export function SignMessage() {
  const { activeAddress, addressState } = useAddress()
  const { hasPasskey, isAuthenticated, cachedWallet, isChecking } = usePasskey()
  const [message, setMessage] = useState('')
  const [signature, setSignature] = useState('')
  const [signingMethod, setSigningMethod] = useState<
    'wallet' | 'passkey' | null
  >(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signMessageAsync, isPending: isWalletPending } = useSignMessage()

  const isWalletSource = addressState.source === 'wallet'
  const isManualSource = addressState.source === 'manual'

  const handleSignWithWallet = async () => {
    if (!message) return

    setError(null)
    setSigningMethod('wallet')

    try {
      const sig = await signMessageAsync({ message })
      setSignature(sig)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to sign message'
      )
    }
  }

  const handleSignWithPasskey = async () => {
    if (!message || !activeAddress) return

    // Check if already authenticated
    if (!isAuthenticated) {
      setError(
        'Please authenticate your passkey first in the Passkey Signing section above.'
      )
      return
    }

    // Check if cached wallet exists
    if (!cachedWallet) {
      setError('Wallet not found. Please re-authenticate with your passkey.')
      return
    }

    setIsLoading(true)
    setError(null)
    setSigningMethod('passkey')

    try {
      // Use the cached wallet directly - NO re-authentication needed!
      const sig = await cachedWallet.signMessage(message)

      setSignature(sig)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to sign with passkey'
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (!activeAddress) return null

  const isPending = isWalletPending || isLoading || isChecking

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-bold text-gray-900">Sign Message</h2>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="message"
            className="mb-1 block text-sm font-medium text-gray-600"
          >
            Message
          </label>
          <textarea
            id="message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Enter a message to sign..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            rows={3}
          />
        </div>

        {isManualSource && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
            <div className="flex gap-2">
              <Info className="h-5 w-5 shrink-0 text-blue-600" />
              <p className="text-sm text-blue-800">
                You're using a manual address. Only passkey signing is
                available.
                {!hasPasskey &&
                  ' Create a passkey first to sign messages with this address.'}
                {hasPasskey &&
                  !isAuthenticated &&
                  ' Authenticate your passkey to start signing.'}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {isWalletSource && (
            <Button
              onClick={handleSignWithWallet}
              disabled={!message || isPending}
              className="w-full"
              variant="default"
            >
              {isWalletPending ? 'Signing with Wallet...' : 'Sign with Wallet'}
            </Button>
          )}

          {hasPasskey && (
            <Button
              onClick={handleSignWithPasskey}
              disabled={!message || isPending || !isAuthenticated}
              className="w-full"
              variant={isManualSource ? 'default' : 'outline'}
            >
              {isLoading
                ? 'Signing with Passkey...'
                : isAuthenticated
                  ? 'Sign with Passkey'
                  : 'Authenticate Passkey First'}
            </Button>
          )}

          {!hasPasskey && isWalletSource && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  Create a passkey to enable biometric signing
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        {signature && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Signature {signingMethod && `(signed with ${signingMethod})`}
            </label>
            <code className="block rounded border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs break-all">
              {signature}
            </code>
          </div>
        )}
      </div>
    </div>
  )
}
