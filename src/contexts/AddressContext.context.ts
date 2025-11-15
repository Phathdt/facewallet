import { createContext } from 'react'

type AddressMode = 'wallet' | 'manual'

interface AddressState {
  address: string | null
  source: 'wallet' | 'manual' | null
}

export interface AddressContextValue {
  addressState: AddressState
  mode: AddressMode
  setMode: (mode: AddressMode) => void
  setManualAddress: (address: string) => void
  clearManualAddress: () => void
  activeAddress: string | null
}

export const AddressContext = createContext<AddressContextValue | undefined>(
  undefined
)
