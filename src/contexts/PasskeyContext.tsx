import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { ethers } from 'ethers'
import { PasskeyECDSASigner } from '@/lib/passkey/PasskeyECDSASigner'
import { useAddress } from './AddressContext'

interface PasskeyContextValue {
  hasPasskey: boolean
  isChecking: boolean
  isAuthenticated: boolean
  cachedWallet: ethers.Wallet | null
  signer: PasskeyECDSASigner
  checkPasskey: () => Promise<void>
  refreshPasskey: () => void
  authenticate: (pin: string) => Promise<ethers.Wallet>
  logout: () => void
}

const PasskeyContext = createContext<PasskeyContextValue | undefined>(undefined)

export function PasskeyProvider({ children }: { children: ReactNode }) {
  const { activeAddress } = useAddress()
  const [hasPasskey, setHasPasskey] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [cachedWallet, setCachedWallet] = useState<ethers.Wallet | null>(null)
  const [signer] = useState(() => new PasskeyECDSASigner())
  const [previousAddress, setPreviousAddress] = useState<string | null>(null)

  // Track registered addresses in session storage (per-session, not persistent)
  const [registeredAddresses, setRegisteredAddresses] = useState<Set<string>>(
    () => {
      const stored = sessionStorage.getItem('facewallet_registered_addresses')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    }
  )

  // Check passkey status (handled in useEffect, but exposed for manual refresh)
  const checkPasskey = useCallback(async () => {
    // Status is automatically updated via useEffect
    return
  }, [])

  // Force refresh passkey status (called after successful registration)
  const refreshPasskey = useCallback(() => {
    if (activeAddress) {
      const newSet = new Set(registeredAddresses)
      newSet.add(activeAddress.toLowerCase())
      setRegisteredAddresses(newSet)
      sessionStorage.setItem(
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
        sessionStorage.setItem(
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAuthenticated(false)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviousAddress(activeAddress)
    }

    // Check passkey status
    if (!activeAddress) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasPasskey(false)
      return
    }

    // Check if we've registered a passkey in this session
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasPasskey(registeredAddresses.has(activeAddress.toLowerCase()))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsChecking(false)
  }, [activeAddress, registeredAddresses, previousAddress])

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

export function usePasskey() {
  const context = useContext(PasskeyContext)
  if (context === undefined) {
    throw new Error('usePasskey must be used within a PasskeyProvider')
  }
  return context
}
