import { useState, useEffect } from 'react'
import { PasskeyECDSASigner } from '@/lib/passkey/PasskeyECDSASigner'

export function usePRFSupport() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    PasskeyECDSASigner.isSupported()
      .then(setSupported)
      .finally(() => setChecking(false))
  }, [])

  return { supported, checking }
}
