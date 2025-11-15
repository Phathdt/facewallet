export interface PasskeyCredential {
  credentialId: string
  address: string
  username: string
  createdAt: number
}

export interface SignerConfig {
  rpName: string
  rpId: string
  prfSalt: string
}
