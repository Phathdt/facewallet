import { createContext, useContext, useState, type ReactNode } from 'react'
import { useAccount } from 'wagmi'

const STORAGE_KEY = 'facewallet_manual_address'
const MODE_STORAGE_KEY = 'facewallet_address_mode'

type AddressMode = 'wallet' | 'manual'

interface AddressState {
  address: string | null
  source: 'wallet' | 'manual' | null
}

interface AddressContextValue {
  addressState: AddressState
  mode: AddressMode
  setMode: (mode: AddressMode) => void
  setManualAddress: (address: string) => void
  clearManualAddress: () => void
  activeAddress: string | null
}

const AddressContext = createContext<AddressContextValue | undefined>(undefined)

// Load manual address from localStorage (only on initial load)
const loadManualAddressFromStorage = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to load manual address from localStorage:', error)
    return null
  }
}

// Load mode from localStorage (only on initial load)
const loadModeFromStorage = (): AddressMode => {
  try {
    const saved = localStorage.getItem(MODE_STORAGE_KEY)
    return saved === 'manual' ? 'manual' : 'wallet'
  } catch (error) {
    console.error('Failed to load mode from localStorage:', error)
    return 'wallet' // default
  }
}

export function AddressProvider({ children }: { children: ReactNode }) {
  const { address: walletAddress, isConnected } = useAccount()
  const [manualAddress, setManualAddressState] = useState<string | null>(
    loadManualAddressFromStorage
  )
  const [mode, setModeState] = useState<AddressMode>(loadModeFromStorage)

  // Compute address state based on mode preference
  const addressState: AddressState =
    mode === 'wallet' && isConnected && walletAddress
      ? { address: walletAddress, source: 'wallet' }
      : mode === 'manual' && manualAddress
        ? { address: manualAddress, source: 'manual' }
        : { address: null, source: null }

  const activeAddress = addressState.address

  const setManualAddress = (address: string) => {
    try {
      setManualAddressState(address)
      localStorage.setItem(STORAGE_KEY, address)
    } catch (error) {
      console.error('Failed to save manual address to localStorage:', error)
    }
  }

  const clearManualAddress = () => {
    try {
      setManualAddressState(null)
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Failed to clear manual address from localStorage:', error)
    }
  }

  const setMode = (newMode: AddressMode) => {
    try {
      setModeState(newMode)
      localStorage.setItem(MODE_STORAGE_KEY, newMode)
    } catch (error) {
      console.error('Failed to save mode to localStorage:', error)
    }
  }

  return (
    <AddressContext.Provider
      value={{
        addressState,
        mode,
        setMode,
        setManualAddress,
        clearManualAddress,
        activeAddress,
      }}
    >
      {children}
    </AddressContext.Provider>
  )
}

export function useAddress() {
  const context = useContext(AddressContext)
  if (context === undefined) {
    throw new Error('useAddress must be used within an AddressProvider')
  }
  return context
}
