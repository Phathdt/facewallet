import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Fingerprint, AlertCircle, LogOut } from 'lucide-react'
import { useAddress } from '@/contexts/AddressContext'
import { usePasskey } from '@/contexts/PasskeyContext'

export function PasskeyManager() {
  const { activeAddress } = useAddress()
  const {
    hasPasskey,
    isAuthenticated,
    signer,
    authenticate,
    logout,
    refreshPasskey,
  } = usePasskey()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleCreatePasskey = async () => {
    if (!activeAddress) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await signer.register(activeAddress)
      refreshPasskey() // Notify context to refresh passkey status
      setSuccess('Passkey created successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to create passkey:', err)
      setError(err instanceof Error ? err.message : 'Failed to create passkey')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAuthenticate = async () => {
    if (!activeAddress) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await authenticate()
      setSuccess('Passkey authenticated successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to authenticate passkey:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to authenticate passkey'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    setSuccess('Logged out successfully')
    setTimeout(() => setSuccess(null), 3000)
  }

  if (!activeAddress) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Passkey Signing</h2>
        {hasPasskey && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">
              {isAuthenticated ? 'Authenticated' : 'Passkey Registered'}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-3">
            <Fingerprint className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="text-sm text-blue-900">
              {hasPasskey ? (
                <>
                  <p className="mb-1 font-medium">
                    {isAuthenticated
                      ? 'Passkey is authenticated and ready to sign'
                      : 'Passkey is registered but not authenticated'}
                  </p>
                  <p className="text-blue-700">
                    {isAuthenticated
                      ? 'You can sign messages without re-authenticating.'
                      : 'Click "Authenticate" to unlock signing with biometrics.'}
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-1 font-medium">
                    Create a passkey to enable biometric signing
                  </p>
                  <p className="text-blue-700">
                    Your passkey will be linked to your wallet address (
                    {activeAddress.slice(0, 6)}...{activeAddress.slice(-4)}) and
                    will derive a separate signing key from your biometric data.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {!hasPasskey ? (
          <Button
            onClick={handleCreatePasskey}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Creating Passkey...' : 'Create Passkey'}
          </Button>
        ) : isAuthenticated ? (
          <Button onClick={handleLogout} variant="outline" className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        ) : (
          <Button
            onClick={handleAuthenticate}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Authenticating...' : 'Authenticate Passkey'}
          </Button>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3">
            <div className="flex gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              <p className="text-sm font-medium text-green-700">{success}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
