import { ethers, keccak256 } from 'ethers'
import type { SignerConfig } from './types'

export class PasskeyECDSASigner {
  private config: SignerConfig

  constructor(config?: Partial<SignerConfig>) {
    // For Vercel deployments (vercel.app), don't specify rpId
    // Let it default to the current origin's effective domain
    const shouldOmitRpId = window.location.hostname.endsWith('.vercel.app')

    this.config = {
      rpName: config?.rpName || import.meta.env.VITE_RP_NAME || 'FaceWallet',
      rpId: shouldOmitRpId
        ? undefined
        : config?.rpId || import.meta.env.VITE_RP_ID || undefined,
      prfSalt: config?.prfSalt || 'ecdsa-signing-key-v1', // Kept for backwards compatibility but not used
      ...config,
    }
  }

  /**
   * Check if PRF extension is supported
   */
  static async isSupported(): Promise<boolean> {
    if (!window.PublicKeyCredential) return false

    try {
      // Feature detection for PRF
      const available =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      if (!available) return false

      // Check for PRF support (Chrome 108+, Safari 17+)
      const userAgent = navigator.userAgent.toLowerCase()
      const isChrome =
        userAgent.includes('chrome') && !userAgent.includes('edge')
      const isSafari =
        userAgent.includes('safari') && !userAgent.includes('chrome')
      const isEdge = userAgent.includes('edge')

      if (isChrome || isEdge) {
        // Chrome/Edge 108+ supports PRF
        const match = userAgent.match(/(?:chrome|edg)\/(\d+)/)
        if (match) {
          const version = parseInt(match[1])
          return version >= 108
        }
      }

      if (isSafari) {
        // Safari 17+ supports PRF
        const match = userAgent.match(/version\/(\d+)/)
        if (match) {
          const version = parseInt(match[1])
          return version >= 17
        }
      }

      return false
    } catch {
      return false
    }
  }

  /**
   * Register a new passkey for a wallet address
   * First checks if a passkey already exists, if so, reuses it
   * Only creates a new passkey if none exists
   * Uses PRF(sha256(PIN)) approach for higher security
   */
  async register(
    walletAddress: string,
    pin: string
  ): Promise<{
    credentialId: string
    isExisting: boolean
  }> {
    // Validate PIN
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      throw new Error('PIN must be exactly 6 digits')
    }

    // Step 1: Hash PIN to create deterministic PRF input
    const pinHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(pin)
    )

    // Step 2: Check if a passkey already exists by attempting authentication
    try {
      // Build options object conditionally
      const getOptions: PublicKeyCredentialRequestOptions = {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        userVerification: 'required',
        timeout: 60000,
        extensions: {
          prf: {
            eval: {
              first: pinHash,
            },
          },
        },
      }

      // Only include rpId if it's defined
      if (this.config.rpId) {
        getOptions.rpId = this.config.rpId
      }

      // Try to authenticate with existing passkey
      const existingCredential = (await navigator.credentials.get({
        publicKey: getOptions,
        mediation: 'optional', // Show passkey picker
      })) as PublicKeyCredential

      if (existingCredential) {
        // Passkey already exists! Return the existing credential ID
        console.log('Using existing passkey for this address')
        return {
          credentialId: this.bufferToBase64(existingCredential.rawId),
          isExisting: true,
        }
      }
    } catch {
      // No existing passkey found or user cancelled, proceed to create new one
      console.log('No existing passkey found, creating new one')
    }

    // Step 3: Create new passkey
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const userId = crypto.getRandomValues(new Uint8Array(16))

    // Truncate address for display: 0x1234...abcd
    const truncatedAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`

    // Build rp object conditionally
    const rp: { name: string; id?: string } = {
      name: this.config.rpName,
    }

    // Only include id if it's defined
    if (this.config.rpId) {
      rp.id = this.config.rpId
    }

    // Create passkey with PRF enabled using PIN hash as input
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp,
        user: {
          id: userId,
          name: truncatedAddress,
          displayName: `Passkey for ${truncatedAddress}`,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          userVerification: 'required',
        },
        extensions: {
          prf: {
            eval: {
              first: pinHash, // Deterministic input from PIN
            },
          },
        },
      },
    })) as PublicKeyCredential

    // Check PRF extension is enabled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extensionResults = credential.getClientExtensionResults() as any
    const prfEnabled = extensionResults.prf?.enabled

    if (!prfEnabled) {
      throw new Error('PRF extension not supported')
    }

    // Step 4: Return credential ID only
    // User will authenticate separately when ready to unlock wallet
    return {
      credentialId: this.bufferToBase64(credential.rawId),
      isExisting: false,
    }
  }

  /**
   * Authenticate with existing passkey and derive signing key
   * Uses PRF(sha256(PIN)) approach for higher security
   * Note: walletAddress parameter kept for API compatibility but not used
   */
  async authenticate(
    _walletAddress: string,
    pin: string
  ): Promise<{
    credentialId: string
    address: string
    wallet: ethers.Wallet
  }> {
    // Validate PIN
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      throw new Error('PIN must be exactly 6 digits')
    }

    // Step 1: Hash PIN to create deterministic PRF input (same as registration)
    const pinHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(pin)
    )

    const challenge = crypto.getRandomValues(new Uint8Array(32))

    // Build options object conditionally
    const getOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      userVerification: 'required',
      timeout: 60000,
      extensions: {
        prf: {
          eval: {
            first: pinHash, // Deterministic input from PIN
          },
        },
      },
    }

    // Only include rpId if it's defined
    if (this.config.rpId) {
      getOptions.rpId = this.config.rpId
    }

    // Step 2: Authenticate with biometric
    const assertion = (await navigator.credentials.get({
      publicKey: getOptions,
      mediation: 'optional', // Show browser's passkey picker
    })) as PublicKeyCredential

    // Step 3: Get PRF output
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extensionResults = assertion.getClientExtensionResults() as any
    const prfResult = extensionResults.prf

    if (!prfResult?.results?.first) {
      throw new Error('Authentication failed')
    }

    // Step 4: Derive private key from PRF output
    const prfOutput = new Uint8Array(prfResult.results.first)
    const privateKeyHex = keccak256(prfOutput)

    // Create wallet from PRF-derived key
    const wallet = new ethers.Wallet(privateKeyHex)

    return {
      credentialId: this.bufferToBase64(assertion.rawId),
      address: wallet.address,
      wallet,
    }
  }

  // Utility functions
  private bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
}
