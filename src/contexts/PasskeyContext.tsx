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

  // Track registered addresses in localStorage (persists across sessions)
  const [registeredAddresses, setRegisteredAddresses] = useState<Set<string>>(
    () => {
      const stored = localStorage.getItem('facewallet_registered_addresses')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    }
  )

  // Check passkey status from localStorage cache
  const checkPasskey = useCallback(async () => {
    if (!activeAddress) {
      setHasPasskey(false)
      return
    }

    // Check localStorage cache
    // Note: This is just a hint. The actual passkey detection happens in register()
    // which will reuse existing passkey if found
    const hasInCache = registeredAddresses.has(activeAddress.toLowerCase())
    setHasPasskey(hasInCache)
  }, [activeAddress, registeredAddresses])

  // Force refresh passkey status (called after successful registration)
  const refreshPasskey = useCallback(() => {
    if (activeAddress) {
      const newSet = new Set(registeredAddresses)
      newSet.add(activeAddress.toLowerCase())
      setRegisteredAddresses(newSet)
      localStorage.setItem(
        'facewallet_registered_addresses',
        JSON.stringify(Array.from(newSet))
      )
      setHasPasskey(true)
    }
  }, [activeAddress, registeredAddresses])

  // Authenticate with passkey and cache wallet
  const authenticate = useCallback(
    async (pin: string) => {
      if (!activeAddress) {
        throw new Error('No active address')
      }

      // Return cached wallet if already authenticated
      if (isAuthenticated && cachedWallet) {
        return cachedWallet
      }

      try {
        const result = await signer.authenticate(activeAddress, pin)
        setCachedWallet(result.wallet)
        setIsAuthenticated(true)

        // Mark this address as having a passkey (successful auth proves it exists)
        const newSet = new Set(registeredAddresses)
        newSet.add(activeAddress.toLowerCase())
        setRegisteredAddresses(newSet)
        localStorage.setItem(
          'facewallet_registered_addresses',
          JSON.stringify(Array.from(newSet))
        )
        setHasPasskey(true)

        return result.wallet
      } catch (error) {
        setIsAuthenticated(false)
        setCachedWallet(null)
        throw error
      }
    },
    [activeAddress, signer, isAuthenticated, cachedWallet, registeredAddresses]
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
