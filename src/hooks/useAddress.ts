import { useContext } from 'react'
import { AddressContext } from '@/contexts/AddressContext.context'

export function useAddress() {
  const context = useContext(AddressContext)
  if (context === undefined) {
    throw new Error('useAddress must be used within an AddressProvider')
  }
  return context
}
