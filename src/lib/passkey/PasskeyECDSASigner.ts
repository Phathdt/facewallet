import { ethers } from 'ethers'
import * as secp256k1 from '@noble/secp256k1'
import { sha256 } from '@noble/hashes/sha2.js'
import { PasskeyStorage } from './storage'
import type { PasskeyCredential, SignerConfig } from './types'

export class PasskeyECDSASigner {
  private storage: PasskeyStorage
  private config: SignerConfig

  constructor(config?: Partial<SignerConfig>) {
    this.storage = new PasskeyStorage()
    this.config = {
      rpName: config?.rpName || 'FaceWallet',
      rpId: config?.rpId || window.location.hostname,
      prfSalt: config?.prfSalt || 'ecdsa-signing-key-v1',
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
   * Register a new passkey for a wallet address and derive signing key
   */
  async register(walletAddress: string): Promise<{
    credentialId: string
    address: string
    wallet: ethers.Wallet
  }> {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const userId = crypto.getRandomValues(new Uint8Array(16))

    // Truncate address for display: 0x1234...abcd
    const truncatedAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: this.config.rpName,
          id: this.config.rpId,
        },
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
              first: new TextEncoder().encode(this.config.prfSalt),
            },
          },
        },
      },
    })) as PublicKeyCredential

    // Get PRF output
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extensionResults = credential.getClientExtensionResults() as any
    const prfOutput = extensionResults.prf?.results?.first

    if (!prfOutput) {
      throw new Error('PRF extension not supported or failed')
    }

    // Derive private key from PRF output (this is separate from wallet's private key)
    const privateKeyBytes = new Uint8Array(prfOutput).slice(0, 32)
    const privateKey = this.ensureValidPrivateKey(privateKeyBytes)
    const privateKeyHex = '0x' + Buffer.from(privateKey).toString('hex')

    // Create wallet from PRF-derived key
    const wallet = new ethers.Wallet(privateKeyHex)

    // Store credential linked to the connected wallet address
    const credentialData: PasskeyCredential = {
      credentialId: this.bufferToBase64(credential.rawId),
      address: walletAddress, // Link to connected wallet address
      username: truncatedAddress,
      createdAt: Date.now(),
    }

    await this.storage.saveCredential(credentialData)

    return {
      credentialId: credentialData.credentialId,
      address: walletAddress,
      wallet,
    }
  }

  /**
   * Authenticate with existing passkey for a wallet address and derive signing key
   */
  async authenticate(walletAddress: string): Promise<{
    credentialId: string
    address: string
    wallet: ethers.Wallet
  }> {
    const challenge = crypto.getRandomValues(new Uint8Array(32))

    // Get stored credential for this wallet address
    const credential = await this.storage.getCredentialByAddress(walletAddress)

    if (!credential) {
      throw new Error('No passkey found for this wallet address')
    }

    const allowCredentials = [
      {
        id: this.base64ToBuffer(credential.credentialId),
        type: 'public-key' as const,
      },
    ]

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: this.config.rpId,
        allowCredentials,
        userVerification: 'required',
        extensions: {
          prf: {
            eval: {
              first: new TextEncoder().encode(this.config.prfSalt),
            },
          },
        },
      },
    })) as PublicKeyCredential

    // Get PRF output
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extensionResults = assertion.getClientExtensionResults() as any
    const prfOutput = extensionResults.prf?.results?.first

    if (!prfOutput) {
      throw new Error('PRF extension not supported or failed')
    }

    // Derive private key from PRF output (same as registration)
    const privateKeyBytes = new Uint8Array(prfOutput).slice(0, 32)
    const privateKey = this.ensureValidPrivateKey(privateKeyBytes)
    const privateKeyHex = '0x' + Buffer.from(privateKey).toString('hex')

    // Create wallet from PRF-derived key
    const wallet = new ethers.Wallet(privateKeyHex)

    return {
      credentialId: credential.credentialId,
      address: walletAddress,
      wallet,
    }
  }

  /**
   * Ensure private key is valid for secp256k1
   */
  private ensureValidPrivateKey(key: Uint8Array): Uint8Array {
    let validKey = new Uint8Array(key)
    while (!secp256k1.utils.isValidSecretKey(validKey)) {
      validKey = new Uint8Array(sha256(validKey))
    }
    return validKey
  }

  /**
   * Check if passkey exists for wallet address
   */
  async hasPasskeyForAddress(walletAddress: string): Promise<boolean> {
    const credential = await this.storage.getCredentialByAddress(walletAddress)
    return credential !== null
  }

  /**
   * Get credential for wallet address
   */
  async getCredentialForAddress(
    walletAddress: string
  ): Promise<PasskeyCredential | null> {
    return this.storage.getCredentialByAddress(walletAddress)
  }

  /**
   * Get all stored credentials
   */
  async getStoredCredentials(): Promise<PasskeyCredential[]> {
    return this.storage.getAllCredentials()
  }

  /**
   * Delete a stored credential
   */
  async deleteCredential(credentialId: string): Promise<void> {
    return this.storage.deleteCredential(credentialId)
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

  private base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }
}
