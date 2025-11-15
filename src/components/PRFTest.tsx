import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ethers } from 'ethers'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { useAddress } from '@/contexts/AddressContext'

export function PRFTest() {
  const { activeAddress, setManualAddress } = useAddress()
  const [localAddress, setLocalAddress] = useState('')
  const [derivedAddress, setDerivedAddress] = useState('')
  const [credentialId, setCredentialId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSetAddress = () => {
    if (!localAddress) {
      setError('Please enter an Ethereum address')
      return
    }

    // Validate address format
    if (!ethers.isAddress(localAddress)) {
      setError('Invalid Ethereum address format')
      return
    }

    setManualAddress(localAddress)
    setError(null)
  }

  const handleUseExistingPasskey = async () => {
    const addressToUse = activeAddress || localAddress

    if (!addressToUse) {
      setError('Please enter an address first')
      return
    }

    // Validate address format
    if (!ethers.isAddress(addressToUse)) {
      setError('Invalid Ethereum address format')
      return
    }

    setIsLoading(true)
    setError(null)
    setDerivedAddress('')
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
      setDerivedAddress(wallet.address)
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
                <p className="mb-2 font-medium">⚠️ Browser Compatibility:</p>
                <p className="mb-3 text-blue-700">
                  PRF extension is currently only supported on:
                </p>
                <ul className="list-inside list-disc space-y-1 text-blue-700 mb-3">
                  <li><strong>Chrome/Edge on macOS/Windows</strong> (with platform authenticator)</li>
                  <li><strong>Safari 17+</strong> (limited support)</li>
                  <li><strong>NOT supported on iPhone/iOS</strong> browsers yet</li>
                </ul>
                <p className="mb-2 font-medium">Test Instructions:</p>
                <ol className="list-inside list-decimal space-y-1 text-blue-700">
                  <li>Create a passkey on the Home page first</li>
                  <li>Click "Test PRF with Existing Passkey" below</li>
                  <li>Authenticate with biometrics to get the PRF-derived address</li>
                  <li>Open this same page on another device (Mac with Chrome/Edge) with same iCloud</li>
                  <li>Use the same passkey and compare addresses</li>
                </ol>
                <p className="mt-3 font-medium text-blue-800">
                  Expected Result: Addresses will be DIFFERENT (PRF is device-specific)
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4 space-y-4">
            {activeAddress ? (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm text-gray-600">
                  <strong>Active Address:</strong> {activeAddress}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                    Enter Ethereum Address (for testing)
                  </Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="address"
                      type="text"
                      value={localAddress}
                      onChange={e => setLocalAddress(e.target.value)}
                      placeholder="0x..."
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSetAddress}
                      variant="outline"
                      disabled={!localAddress}
                    >
                      Set
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Or go to Home page to connect your wallet
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleUseExistingPasskey}
            disabled={isLoading || (!activeAddress && !localAddress)}
            className="w-full"
            size="lg"
          >
            {isLoading ? 'Authenticating...' : 'Test PRF with Existing Passkey'}
          </Button>

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            </div>
          )}

          {derivedAddress && (
            <div className="mt-4 space-y-4">
              <div className="rounded-md border border-green-200 bg-green-50 p-3">
                <div className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  <p className="text-sm font-medium text-green-700">
                    PRF authentication successful!
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-600">
                  Derived Address (from PRF output)
                </label>
                <code className="block rounded border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm break-all">
                  {derivedAddress}
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
              <strong>PRF Salt:</strong> <code>"ecdsa-signing-key-v1"</code>{' '}
              (same as production)
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
              This test verifies whether PRF output is deterministic across
              devices or device-specific (using device Secure Enclave/TPM).
            </p>
            <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                Why PRF is Not Supported Everywhere:
              </p>
              <p className="text-sm text-yellow-700">
                The PRF extension is a newer WebAuthn feature that requires
                platform authenticator support. iOS/iPhone browsers don't support
                PRF yet, which is why FaceWallet uses PIN-based key derivation
                instead of PRF-based for cross-device compatibility.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
