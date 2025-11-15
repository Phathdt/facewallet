import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ethers } from 'ethers'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { useAddress } from '@/contexts/AddressContext'

export function PRFTest() {
  const { activeAddress } = useAddress()
  const [address, setAddress] = useState('')
  const [credentialId, setCredentialId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testMode, setTestMode] = useState<'create' | 'existing'>('existing')

  const handleCreatePasskey = async () => {
    setIsLoading(true)
    setError(null)
    setAddress('')
    setCredentialId('')

    try {
      // Check if WebAuthn is supported
      if (!navigator.credentials || !window.PublicKeyCredential) {
        throw new Error('WebAuthn is not supported in this browser')
      }

      // Detect Vercel deployment
      const shouldOmitRpId = window.location.hostname.endsWith('.vercel.app')

      // Create credential with PRF
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {
            name: 'FaceWallet PRF Test',
            ...(shouldOmitRpId ? {} : { id: window.location.hostname }),
          },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: 'prf-test@facewallet.app',
            displayName: 'PRF Test User',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            requireResidentKey: true,
            residentKey: 'required',
            userVerification: 'required',
          },
          timeout: 60000,
          attestation: 'none',
          extensions: {
            prf: {
              eval: {
                first: new TextEncoder().encode('prf-test-salt'),
              },
            },
          },
        },
      })) as PublicKeyCredential & {
        getClientExtensionResults: () => {
          prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } }
        }
      }

      if (!credential) {
        throw new Error('Failed to create credential')
      }

      // Check PRF support
      const prfResults = credential.getClientExtensionResults().prf
      if (!prfResults?.enabled) {
        throw new Error(
          'PRF extension not supported on this device/authenticator'
        )
      }

      // Store credential ID for future authentication
      const credId = bufferToBase64(credential.rawId)
      setCredentialId(credId)

      // Derive private key from PRF output
      const prfFirstResult = prfResults.results!.first!
      const prfOutput =
        prfFirstResult instanceof ArrayBuffer
          ? new Uint8Array(prfFirstResult)
          : new Uint8Array(prfFirstResult.buffer)
      const privateKeyHex =
        '0x' +
        Array.from(prfOutput)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
          .slice(0, 64)

      // Create wallet and get address
      const wallet = new ethers.Wallet(privateKeyHex)
      setAddress(wallet.address)
    } catch (err) {
      console.error('PRF Test Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create passkey')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseExistingPasskey = async () => {
    if (!activeAddress) {
      setError('Please connect a wallet or enter an address on the Home page first')
      return
    }

    setIsLoading(true)
    setError(null)
    setAddress('')
    setCredentialId('')

    try {
      // Check if WebAuthn is supported
      if (!navigator.credentials || !window.PublicKeyCredential) {
        throw new Error('WebAuthn is not supported in this browser')
      }

      // Detect Vercel deployment
      const shouldOmitRpId = window.location.hostname.endsWith('.vercel.app')

      // Authenticate with existing passkey using PRF
      const credential = (await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          timeout: 60000,
          userVerification: 'required',
          ...(shouldOmitRpId ? {} : { rpId: window.location.hostname }),
          extensions: {
            prf: {
              eval: {
                first: new TextEncoder().encode('ecdsa-signing-key-v1'),
              },
            },
          },
        },
      })) as PublicKeyCredential & {
        getClientExtensionResults: () => {
          prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } }
        }
      }

      if (!credential) {
        throw new Error('Failed to authenticate with passkey')
      }

      // Check PRF support and results
      const prfResults = credential.getClientExtensionResults().prf
      if (!prfResults?.enabled) {
        throw new Error(
          'PRF extension not supported on this device/authenticator'
        )
      }

      if (!prfResults.results?.first) {
        throw new Error('PRF output not available')
      }

      // Store credential ID
      const credId = bufferToBase64(credential.rawId)
      setCredentialId(credId)

      // Derive private key from PRF output (same as production code)
      const prfFirstResult = prfResults.results.first
      const prfOutput =
        prfFirstResult instanceof ArrayBuffer
          ? new Uint8Array(prfFirstResult)
          : new Uint8Array(prfFirstResult.buffer)
      const privateKeyHex =
        '0x' +
        Array.from(prfOutput)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
          .slice(0, 64)

      // Create wallet and get address
      const wallet = new ethers.Wallet(privateKeyHex)
      setAddress(wallet.address)
    } catch (err) {
      console.error('PRF Test Error:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to authenticate with passkey'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const bufferToBase64 = (buffer: ArrayBuffer): string => {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            PRF Determinism Test
          </h1>

          <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 shrink-0 text-blue-600" />
              <div className="text-sm text-blue-900">
                <p className="mb-2 font-medium">Test Instructions:</p>
                <ol className="list-inside list-decimal space-y-1 text-blue-700">
                  <li>
                    Choose "Use Existing Passkey" if you created one on the Home
                    page
                  </li>
                  <li>Or choose "Create New Passkey" to test with a fresh one</li>
                  <li>
                    Authenticate with biometrics to get the PRF-derived address
                  </li>
                  <li>
                    Open this same page on another device (iPhone/Mac) with same
                    iCloud
                  </li>
                  <li>Use the same passkey and compare addresses</li>
                </ol>
                <p className="mt-3 font-medium text-blue-800">
                  Expected Result: Addresses will be DIFFERENT (PRF is
                  device-specific)
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4 space-y-3">
            <Label className="text-sm font-medium text-gray-700">
              Choose Test Mode:
            </Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="testMode"
                  value="existing"
                  checked={testMode === 'existing'}
                  onChange={() => setTestMode('existing')}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-700">Use Existing Passkey</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="testMode"
                  value="create"
                  checked={testMode === 'create'}
                  onChange={() => setTestMode('create')}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-700">Create New Passkey</span>
              </label>
            </div>
          </div>

          {testMode === 'existing' ? (
            <div className="space-y-4">
              {activeAddress && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm text-gray-600">
                    <strong>Current Address:</strong> {activeAddress}
                  </p>
                </div>
              )}
              <Button
                onClick={handleUseExistingPasskey}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading
                  ? 'Authenticating...'
                  : 'Authenticate with Existing Passkey'}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleCreatePasskey}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Creating Passkey...' : 'Create New Passkey with PRF'}
            </Button>
          )}

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            </div>
          )}

          {address && (
            <div className="mt-4 space-y-4">
              <div className="rounded-md border border-green-200 bg-green-50 p-3">
                <div className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  <p className="text-sm font-medium text-green-700">
                    {testMode === 'existing'
                      ? 'Passkey authenticated successfully!'
                      : 'Passkey created successfully!'}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-600">
                  Derived Address (from PRF output)
                </label>
                <code className="block rounded border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm break-all">
                  {address}
                </code>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-600">
                  Credential ID
                </label>
                <code className="block rounded border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs break-all">
                  {credentialId}
                </code>
              </div>

              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 shrink-0 text-yellow-600" />
                  <div className="text-sm text-yellow-900">
                    <p className="mb-1 font-medium">Next Steps:</p>
                    <p className="text-yellow-700">
                      Copy this address and compare it with the address
                      generated on your other device (iPhone/Mac) using the same
                      iCloud passkey.
                    </p>
                    <p className="mt-2 font-medium text-yellow-800">
                      If addresses are different → PRF is device-specific ✓
                    </p>
                    <p className="text-yellow-800">
                      If addresses are the same → PRF output syncs (unexpected)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-gray-900">
            Technical Details
          </h2>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <strong>PRF Salt:</strong> <code>"prf-test-salt"</code>
            </p>
            <p>
              <strong>Key Derivation:</strong> Private key is first 64 hex chars
              of PRF output
            </p>
            <p>
              <strong>PRF Extension:</strong> Uses WebAuthn{' '}
              <code>prf.eval.first</code>
            </p>
            <p className="mt-3 italic text-gray-600">
              This test helps verify whether PRF output is deterministic across
              devices or device-specific (using device Secure Enclave/TPM).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
