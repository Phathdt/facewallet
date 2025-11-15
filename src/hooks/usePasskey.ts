import { useContext } from 'react'
import { PasskeyContext } from '@/contexts/PasskeyContext.context'

export function usePasskey() {
  const context = useContext(PasskeyContext)
  if (context === undefined) {
    throw new Error('usePasskey must be used within a PasskeyProvider')
  }
  return context
}
