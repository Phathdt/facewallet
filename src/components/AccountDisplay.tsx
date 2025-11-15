import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, CheckCircle2, X, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useAddress } from '@/contexts/AddressContext'

export function AccountDisplay() {
  const { addressState, activeAddress, clearManualAddress, mode, setMode } =
    useAddress()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (activeAddress) {
      await navigator.clipboard.writeText(activeAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!activeAddress) return null

  const isWalletSource = addressState.source === 'wallet'
  const isManualSource = addressState.source === 'manual'

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-gray-900">Account</h2>

        {/* Integrated Mode Switcher */}
        <div className="flex flex-col gap-3 sm:items-end">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            <Button
              variant={mode === 'wallet' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('wallet')}
              className="relative h-8 rounded-md px-3 text-xs font-medium transition-all"
            >
              <Wallet className="mr-1.5 h-3.5 w-3.5" />
              Wallet
            </Button>
            <Button
              variant={mode === 'manual' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('manual')}
              className="relative h-8 rounded-md px-3 text-xs font-medium transition-all"
            >
              Manual
            </Button>
          </div>

          {/* Status Badge */}
          <div className="flex justify-end">
            {isWalletSource && (
              <Badge variant="success" className="text-xs">
                Connected via Wallet
              </Badge>
            )}
            {isManualSource && (
              <Badge variant="secondary" className="text-xs">
                Manual Address
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-600">
            Address
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm break-all">
              {activeAddress}
            </code>
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {isManualSource && (
          <Button
            onClick={clearManualAddress}
            variant="outline"
            className="w-full"
          >
            <X className="mr-2 h-4 w-4" />
            Clear Manual Address
          </Button>
        )}
      </div>
    </div>
  )
}
