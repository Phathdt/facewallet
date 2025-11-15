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
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Check if passkey exists for current address
  const checkPasskey = useCallback(async () => {
    if (!activeAddress) {
      setHasPasskey(false)
      return
    }

    setIsChecking(true)
    try {
      const exists = await signer.hasPasskeyForAddress(activeAddress)
      setHasPasskey(exists)
    } catch (err) {
      console.error('Failed to check passkey:', err)
      setHasPasskey(false)
    } finally {
      setIsChecking(false)
    }
  }, [activeAddress, signer])

  // Force refresh passkey status
  const refreshPasskey = useCallback(() => {
    setRefreshTrigger(prev => prev + 1)
  }, [])

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

  // Reset authentication state when address changes
  useEffect(() => {
    setCachedWallet(null)
    setIsAuthenticated(false)
  }, [activeAddress])

  // Check passkey when address changes or refresh is triggered
  useEffect(() => {
    checkPasskey()
  }, [checkPasskey, refreshTrigger])

  return (
    <PasskeyContext.Provider
      value={{
        hasPasskey,
        isChecking,
        isAuthenticated,
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
