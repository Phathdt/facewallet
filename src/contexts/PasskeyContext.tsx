import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { ethers } from 'ethers'
import { PasskeyECDSASigner } from '@/lib/passkey/PasskeyECDSASigner'
import { useAddress } from '@/hooks/useAddress'
import { PasskeyContext } from './PasskeyContext.context'

export function PasskeyProvider({ children }: { children: ReactNode }) {
  const { activeAddress } = useAddress()
  const [hasPasskey, setHasPasskey] = useState(false)
  const [isChecking] = useState(false) // Not used currently but kept for API compatibility
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [cachedWallet, setCachedWallet] = useState<ethers.Wallet | null>(null)
  const [signer] = useState(() => new PasskeyECDSASigner())
  const [previousAddress, setPreviousAddress] = useState<string | null>(null)

  // Simple passkey check - no caching, no localStorage
  // The register() method will detect existing passkeys automatically
  const checkPasskey = useCallback(async () => {
    // Don't assume anything - let register() detect existing passkeys
    setHasPasskey(false)
  }, [])

  // Force refresh passkey status (called after successful authentication)
  const refreshPasskey = useCallback(() => {
    if (activeAddress) {
      // Mark as having passkey only after successful registration/authentication
      setHasPasskey(true)
    }
  }, [activeAddress])

  // Authenticate with passkey and cache wallet (in-memory only, per session)
  const authenticate = useCallback(
    async (pin: string) => {
      if (!activeAddress) {
        throw new Error('No active address')
      }

      // Return cached wallet if already authenticated in this session
      if (isAuthenticated && cachedWallet) {
        return cachedWallet
      }

      try {
        const result = await signer.authenticate(activeAddress, pin)
        setCachedWallet(result.wallet)
        setIsAuthenticated(true)
        setHasPasskey(true)

        return result.wallet
      } catch (error) {
        setIsAuthenticated(false)
        setCachedWallet(null)
        throw error
      }
    },
    [activeAddress, signer, isAuthenticated, cachedWallet]
  )

  // Logout and clear cached wallet
  const logout = useCallback(() => {
    setCachedWallet(null)
    setIsAuthenticated(false)
  }, [])

  // Reset authentication state and check passkey when address changes
  useEffect(() => {
    // Only reset auth state if the address actually changed (not on registeredAddresses update)
    const addressChanged = activeAddress !== previousAddress

    if (addressChanged) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCachedWallet(null)

      setIsAuthenticated(false)

      setPreviousAddress(activeAddress)
    }

    // Check passkey status when address changes
    if (addressChanged) {
      checkPasskey()
    }
  }, [activeAddress, previousAddress, checkPasskey])

  return (
    <PasskeyContext.Provider
      value={{
        hasPasskey,
        isChecking,
        isAuthenticated,
        cachedWallet,
        signer,
        checkPasskey,
        refreshPasskey,
        authenticate,
        logout,
      }}
    >
      {children}
    </PasskeyContext.Provider>
  )
}
