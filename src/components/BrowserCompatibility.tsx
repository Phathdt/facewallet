import { usePRFSupport } from '@/hooks/usePRFSupport'

export function BrowserCompatibility() {
  const { supported, checking } = usePRFSupport()

  if (checking) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-blue-700">Checking browser compatibility...</p>
      </div>
    )
  }

  if (!supported) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <h3 className="mb-2 font-bold text-yellow-900">
          Browser Not Supported
        </h3>
        <p className="mb-2 text-yellow-700">
          Passkey wallets require Chrome 108+, Safari 17+, or Edge 108+ with
          platform authenticator support.
        </p>
        <p className="text-yellow-700">
          You can still connect using MetaMask or WalletConnect.
        </p>
      </div>
    )
  }

  return null
}
