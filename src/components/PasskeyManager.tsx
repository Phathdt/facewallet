import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Fingerprint, AlertCircle, LogOut } from 'lucide-react'
import { useAddress } from '@/hooks/useAddress'
import { usePasskey } from '@/hooks/usePasskey'

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
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleCreatePasskey = async () => {
    if (!activeAddress) return

    if (pin.length !== 6) {
      setError('PIN must be 6 digits')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await signer.register(activeAddress, pin)
      refreshPasskey() // Notify context to refresh passkey status

      if (result.isExisting) {
        setSuccess('Using existing passkey for this address!')
      } else {
        setSuccess('Passkey created successfully!')
      }

      setPin('') // Clear PIN for security
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create passkey')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAuthenticate = async () => {
    if (!activeAddress) return

    if (pin.length !== 6) {
      setError('PIN must be 6 digits')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await authenticate(pin)
      setSuccess('Passkey authenticated successfully!')
      setPin('') // Clear PIN for security
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
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
                      : 'Enter your PIN and authenticate with biometrics to unlock signing.'}
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-1 font-medium">
                    Create a passkey to enable biometric signing with PIN
                  </p>
                  <p className="text-blue-700">
                    You'll create a 6-digit PIN and authenticate with
                    biometrics. Same PIN + same passkey = same signature across
                    all devices.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* PIN Input - Show when creating passkey or authenticating */}
        {!hasPasskey || !isAuthenticated ? (
          <div className="space-y-2">
            <Label htmlFor="pin" className="text-sm font-medium text-gray-700">
              {!hasPasskey ? 'Create 6-digit PIN' : 'Enter your PIN'}
            </Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit PIN"
              className="text-center text-lg tracking-widest"
            />
            <p className="text-xs text-gray-500">
              {!hasPasskey
                ? 'This PIN will be used to derive your signing key. Keep it secure!'
                : 'Use the same PIN you created when registering the passkey'}
            </p>
          </div>
        ) : null}

        {!hasPasskey ? (
          <Button
            onClick={handleCreatePasskey}
            disabled={isLoading || pin.length !== 6}
            className="w-full"
          >
            {isLoading ? 'Creating Passkey...' : 'Create Passkey with PIN'}
          </Button>
        ) : isAuthenticated ? (
          <Button onClick={handleLogout} variant="outline" className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        ) : (
          <Button
            onClick={handleAuthenticate}
            disabled={isLoading || pin.length !== 6}
            className="w-full"
          >
            {isLoading ? 'Authenticating...' : 'Authenticate with PIN'}
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
