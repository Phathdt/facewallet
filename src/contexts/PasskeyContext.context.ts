import { createContext } from 'react'
import { ethers } from 'ethers'
import { PasskeyECDSASigner } from '@/lib/passkey/PasskeyECDSASigner'

export interface PasskeyContextValue {
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

export const PasskeyContext = createContext<PasskeyContextValue | undefined>(
  undefined
)
