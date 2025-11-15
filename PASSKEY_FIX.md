# Passkey Cross-Device Signature Consistency Fix

## Problem
Same passkey synced via iCloud produces different signatures on different devices (Chrome Mac vs iPhone) because PRF output is device-specific.

## Root Cause
- PRF uses device's Secure Enclave/TPM
- iCloud syncs credential ID, NOT the PRF secret
- Different devices = Different PRF outputs = Different private keys

## Solution Options

### Option 1: Credential ID as Seed (Recommended for Cross-Device)
Use the credential ID (which syncs) as the deterministic seed for key derivation.

```typescript
import { keccak256 } from 'ethers'

async register(username: string): Promise<{
  credentialId: string
  publicKey: string
}> {
  // ... existing code to create credential ...

  this.credentialId = credential.rawId

  // Derive private key from credential ID (which DOES sync)
  const credentialIdBytes = new Uint8Array(this.credentialId)
  const hash = keccak256(credentialIdBytes)
  const privateKeyHex = hash // Already 32 bytes / 64 hex chars

  this.wallet = new ethers.Wallet(privateKeyHex)

  return {
    credentialId: bufferToBase64(this.credentialId),
    publicKey: this.wallet.address,
  }
}

async authenticate(credentialIdBase64: string): Promise<string> {
  const credentialId = base64ToBuffer(credentialIdBase64)

  // ... existing code to authenticate ...

  // Derive SAME private key from credential ID
  const credentialIdBytes = new Uint8Array(credentialId)
  const hash = keccak256(credentialIdBytes)
  const privateKeyHex = hash

  this.wallet = new ethers.Wallet(privateKeyHex)
  this.credentialId = credentialId

  return this.wallet.address
}
```

**Pros:**
✅ Same signature across all devices
✅ Credential ID syncs via iCloud/Google
✅ Deterministic and reproducible

**Cons:**
⚠️ Less secure - private key derivable from credential ID alone
⚠️ Anyone with credential ID can compute private key
⚠️ Doesn't use biometric protection after initial auth

### Option 2: Keep PRF (Device-Specific Keys)
Accept that each device has a unique key. This is actually MORE secure.

**Current behavior (no changes needed):**
- Each device = unique private key
- Biometric required for every signature
- Maximum security (keys never leave device)

**Pros:**
✅ Maximum security
✅ Keys protected by hardware
✅ Biometric-gated signing

**Cons:**
⚠️ Different signatures per device
⚠️ Can't verify "same account" across devices by signature alone

### Option 3: Hybrid Approach (Best of Both Worlds)
Use credential ID for deterministic address, but still require biometric for signing.

```typescript
async register(username: string): Promise<{
  credentialId: string
  publicKey: string
  devicePublicKey: string
}> {
  // ... create credential with PRF ...

  this.credentialId = credential.rawId
  const prfOutput = new Uint8Array(prfResult.results.first)

  // Device-specific wallet (for actual signing)
  const devicePrivateKey = '0x' + Buffer.from(prfOutput).toString('hex').slice(0, 64)
  this.wallet = new ethers.Wallet(devicePrivateKey)

  // Deterministic address (for account identification)
  const credentialIdBytes = new Uint8Array(this.credentialId)
  const accountHash = keccak256(credentialIdBytes)
  const accountWallet = new ethers.Wallet(accountHash)

  return {
    credentialId: bufferToBase64(this.credentialId),
    publicKey: accountWallet.address,        // Same across devices
    devicePublicKey: this.wallet.address,    // Unique per device
  }
}
```

**Pros:**
✅ Consistent account address across devices
✅ Still uses biometric protection
✅ Can identify "same user" by publicKey

**Cons:**
⚠️ Signatures still different (but that's okay for verification)
⚠️ More complex implementation

## Recommendation

**For your use case (signing messages/transactions):**

If you need **same signature across devices** → Use **Option 1** (Credential ID as seed)
- Sacrifice some security for convenience
- Good for multi-device UX

If you prioritize **security** → Use **Option 2** (Keep current PRF approach)
- Accept different signatures per device
- Maximum security

If you need **both** → Use **Option 3** (Hybrid)
- Deterministic account address
- Device-specific signing keys
- Best balance

## Implementation

I recommend **Option 1** for simplicity and cross-device consistency:

```typescript
import { keccak256 } from 'ethers'

// In both register() and authenticate():
const credentialIdBytes = new Uint8Array(credentialId)
const privateKeyHex = keccak256(credentialIdBytes) // Deterministic from credential ID
this.wallet = new ethers.Wallet(privateKeyHex)
```

This ensures:
- Same passkey = Same credential ID (syncs via iCloud)
- Same credential ID = Same private key
- Same private key + same message = Same signature ✅
