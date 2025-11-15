import { useState } from 'react'
import { isAddress } from 'viem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddress } from '@/contexts/AddressContext'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'

interface ValidationResult {
  valid: boolean
  error?: string
}

const validateAddress = (input: string): ValidationResult => {
  if (!input.trim()) {
    return { valid: false, error: 'Address is required' }
  }

  if (!input.startsWith('0x')) {
    return { valid: false, error: 'Address must start with 0x' }
  }

  if (!isAddress(input)) {
    return { valid: false, error: 'Invalid Ethereum address format' }
  }

  return { valid: true }
}

export function ManualAddressInput() {
  const { addressState, setManualAddress, clearManualAddress } = useAddress()
  const [inputValue, setInputValue] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const isManualAddressSet =
    addressState.source === 'manual' && addressState.address

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    setValidationError(null)
    setShowSuccess(false)
  }

  const handleSetAddress = () => {
    const validation = validateAddress(inputValue)

    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid address')
      return
    }

    setManualAddress(inputValue)
    setShowSuccess(true)
    setInputValue('')
    setValidationError(null)

    setTimeout(() => setShowSuccess(false), 3000)
  }

  const handleClearAddress = () => {
    clearManualAddress()
    setInputValue('')
    setValidationError(null)
    setShowSuccess(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      handleSetAddress()
    }
  }

  return (
    <div className="space-y-4">
      {isManualAddressSet ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div className="flex-1">
              <p className="mb-1 text-sm font-medium text-green-900">
                Manual address set
              </p>
              <code className="block text-xs break-all text-green-700">
                {addressState.address}
              </code>
            </div>
            <Button
              onClick={handleClearAddress}
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-green-600 hover:bg-green-100 hover:text-green-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="manual-address">Enter Ethereum Address</Label>
            <Input
              id="manual-address"
              type="text"
              placeholder="0x..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              className="font-mono text-sm"
              aria-invalid={!!validationError}
            />
          </div>

          {validationError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <div className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <p className="text-sm text-red-700">{validationError}</p>
              </div>
            </div>
          )}

          {showSuccess && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3">
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <p className="text-sm text-green-700">
                  Address set successfully!
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handleSetAddress}
            disabled={!inputValue.trim()}
            className="w-full"
          >
            Set Address
          </Button>
        </>
      )}
    </div>
  )
}
