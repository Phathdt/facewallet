# Cross-Device Signature Consistency Options

**Goal**: Generate the same signature for the same message across different devices using the same passkey.

---

## Option 1: Use Credential ID as Deterministic Seed ⭐ RECOMMENDED

### How It Works
- Derive private key from credential ID (which syncs via iCloud/Google)
- Credential ID is the same across all devices
- Hash the credential ID to get a 32-byte private key

### Implementation
```typescript
import { keccak256 } from 'ethers'

async register(username: string) {
  // ... create credential ...

  this.credentialId = credential.rawId

  // Derive deterministic private key from credential ID
  const credentialIdBytes = new Uint8Array(this.credentialId)
  const privateKeyHex = keccak256(credentialIdBytes) // 32 bytes hash
  this.wallet = new ethers.Wallet(privateKeyHex)

  return {
    credentialId: bufferToBase64(this.credentialId),
    publicKey: this.wallet.address,
  }
}

async authenticate(credentialIdBase64: string) {
  const credentialId = base64ToBuffer(credentialIdBase64)

  // ... authenticate with passkey ...

  // Derive SAME private key from credential ID
  const credentialIdBytes = new Uint8Array(credentialId)
  const privateKeyHex = keccak256(credentialIdBytes)
  this.wallet = new ethers.Wallet(privateKeyHex)

  return this.wallet.address
}
```

### Pros
✅ Same signature across ALL devices
✅ Simple implementation
✅ Works with iCloud Keychain sync
✅ Predictable and deterministic
✅ No additional user input required

### Cons
⚠️ Private key can be derived by anyone with credential ID
⚠️ Less secure than hardware-bound keys
⚠️ Doesn't leverage PRF's security benefits
⚠️ Biometric only protects credential access, not signing

### Security Level
🔒 **Medium** - Credential ID is semi-public (stored in IndexedDB)

### Use Cases
- Multi-device wallet with consistent address
- Cross-platform signing (Mac, iPhone, iPad)
- User expects "same account, same signatures"

---

## Option 2: Credential ID + User Password/PIN

### How It Works
- Derive private key from: `hash(credential_id + user_password)`
- User enters password/PIN after biometric authentication
- Adds an extra entropy layer

### Implementation
```typescript
import { keccak256, concat } from 'ethers'

async register(username: string, password: string) {
  // ... create credential ...

  this.credentialId = credential.rawId

  // Combine credential ID with user password
  const credentialIdBytes = new Uint8Array(this.credentialId)
  const passwordBytes = new TextEncoder().encode(password)
  const combined = concat([credentialIdBytes, passwordBytes])

  const privateKeyHex = keccak256(combined)
  this.wallet = new ethers.Wallet(privateKeyHex)

  return {
    credentialId: bufferToBase64(this.credentialId),
    publicKey: this.wallet.address,
  }
}

async authenticate(credentialIdBase64: string, password: string) {
  const credentialId = base64ToBuffer(credentialIdBase64)

  // ... authenticate with passkey ...

  // Derive SAME private key with password
  const credentialIdBytes = new Uint8Array(credentialId)
  const passwordBytes = new TextEncoder().encode(password)
  const combined = concat([credentialIdBytes, passwordBytes])

  const privateKeyHex = keccak256(combined)
  this.wallet = new ethers.Wallet(privateKeyHex)

  return this.wallet.address
}
```

### Pros
✅ Same signature across devices
✅ Much more secure than Option 1
✅ Password adds entropy
✅ Can't derive key without password
✅ Works with sync

### Cons
⚠️ User must remember password
⚠️ Extra step (biometric + password)
⚠️ Poor UX compared to pure passkey
⚠️ Password storage/management needed

### Security Level
🔒🔒 **High** - Requires both credential access AND password knowledge

### Use Cases
- High-security wallets
- Users comfortable with password management
- Enterprise/professional use

---

## Option 3: Server-Assisted Key Derivation (KMS)

### How It Works
- Server stores encrypted key material
- Use credential ID to identify user
- Server returns encrypted private key
- Decrypt with PRF output (device-specific decryption)

### Implementation
```typescript
async register(username: string) {
  // ... create credential with PRF ...

  const prfOutput = new Uint8Array(prfResult.results.first)
  const credentialId = bufferToBase64(credential.rawId)

  // Generate wallet
  const privateKeyHex = keccak256(new Uint8Array(this.credentialId))
  this.wallet = new ethers.Wallet(privateKeyHex)

  // Encrypt private key with PRF output (device-specific)
  const encryptedKey = await this.encryptKey(privateKeyHex, prfOutput)

  // Store encrypted key on server
  await fetch('/api/store-key', {
    method: 'POST',
    body: JSON.stringify({
      credentialId,
      encryptedKey,
      publicKey: this.wallet.address,
    }),
  })

  return { credentialId, publicKey: this.wallet.address }
}

async authenticate(credentialIdBase64: string) {
  // ... authenticate with PRF ...

  const prfOutput = new Uint8Array(prfResult.results.first)

  // Fetch encrypted key from server
  const response = await fetch(`/api/get-key?credentialId=${credentialIdBase64}`)
  const { encryptedKey } = await response.json()

  // Decrypt with PRF output
  const privateKeyHex = await this.decryptKey(encryptedKey, prfOutput)
  this.wallet = new ethers.Wallet(privateKeyHex)

  return this.wallet.address
}
```

### Pros
✅ Same signature across devices
✅ Server-side key recovery
✅ Can implement key rotation
✅ Can add 2FA/rate limiting
✅ Biometric protection still active

### Cons
⚠️ Requires backend infrastructure
⚠️ Server becomes attack target
⚠️ Dependence on server availability
⚠️ Privacy concerns (server knows user's keys exist)
⚠️ Complex implementation

### Security Level
🔒🔒🔒 **Very High** - But depends on server security

### Use Cases
- Enterprise wallets
- Managed wallet services
- Key recovery features needed
- Regulated environments

---

## Option 4: Credential ID + Device-Specific Salt (Hybrid)

### How It Works
- First device generates random salt and stores it
- Salt syncs across devices (via server or local storage)
- Derive key from `hash(credential_id + salt)`

### Implementation
```typescript
import { keccak256, concat, randomBytes } from 'ethers'

async register(username: string) {
  // ... create credential ...

  this.credentialId = credential.rawId

  // Generate random salt (only once)
  const salt = randomBytes(32)
  localStorage.setItem('passkey_salt', salt)

  // Derive private key
  const credentialIdBytes = new Uint8Array(this.credentialId)
  const combined = concat([credentialIdBytes, salt])
  const privateKeyHex = keccak256(combined)
  this.wallet = new ethers.Wallet(privateKeyHex)

  return {
    credentialId: bufferToBase64(this.credentialId),
    publicKey: this.wallet.address,
    salt: salt.toString('hex'), // User must save this!
  }
}

async authenticate(credentialIdBase64: string, saltHex?: string) {
  // ... authenticate ...

  // Retrieve salt (from localStorage or user input)
  const salt = saltHex
    ? Buffer.from(saltHex, 'hex')
    : localStorage.getItem('passkey_salt')

  if (!salt) {
    throw new Error('Salt required. Please enter your recovery salt.')
  }

  const credentialIdBytes = new Uint8Array(credentialId)
  const combined = concat([credentialIdBytes, salt])
  const privateKeyHex = keccak256(combined)
  this.wallet = new ethers.Wallet(privateKeyHex)

  return this.wallet.address
}
```

### Pros
✅ Same signature across devices
✅ More secure than Option 1
✅ No server required
✅ Can backup salt separately
✅ Additional entropy layer

### Cons
⚠️ User must backup/transfer salt
⚠️ Lose salt = lose access
⚠️ Manual sync between devices
⚠️ Complex UX

### Security Level
🔒🔒 **High** - Requires credential + salt

### Use Cases
- Self-custody wallets
- Power users
- No server dependency acceptable

---

## Option 5: Username-Based Derivation

### How It Works
- Use username (Ethereum address) as deterministic seed
- Same username = same private key
- Simplest but least secure

### Implementation
```typescript
import { keccak256 } from 'ethers'

async register(username: string) {
  // ... create credential (for biometric auth only) ...

  // Derive key from username
  const usernameBytes = new TextEncoder().encode(username)
  const privateKeyHex = keccak256(usernameBytes)
  this.wallet = new ethers.Wallet(privateKeyHex)

  return {
    credentialId: bufferToBase64(credential.rawId),
    publicKey: this.wallet.address,
  }
}

async authenticate(credentialIdBase64: string, username: string) {
  // ... authenticate (just for biometric check) ...

  // Derive SAME key from username
  const usernameBytes = new TextEncoder().encode(username)
  const privateKeyHex = keccak256(usernameBytes)
  this.wallet = new ethers.Wallet(privateKeyHex)

  return this.wallet.address
}
```

### Pros
✅ Same signature across devices
✅ Extremely simple
✅ No storage needed
✅ Fully deterministic

### Cons
⚠️ VERY insecure - anyone knowing username can derive key
⚠️ Username must be kept secret (defeats purpose)
⚠️ Passkey only for authentication, not key protection
⚠️ Not recommended for production

### Security Level
🔒 **Very Low** - Username is public information

### Use Cases
- Demo/testing only
- Educational purposes
- DO NOT USE IN PRODUCTION

---

## Comparison Table

| Option | Security | UX | Complexity | Same Signature | Backend Required |
|--------|----------|-----|------------|----------------|------------------|
| **1. Credential ID** | 🔒 Medium | ⭐⭐⭐⭐⭐ Excellent | ⭐ Simple | ✅ Yes | ❌ No |
| **2. ID + Password** | 🔒🔒 High | ⭐⭐⭐ Good | ⭐⭐ Medium | ✅ Yes | ❌ No |
| **3. Server KMS** | 🔒🔒🔒 Very High | ⭐⭐⭐⭐ Very Good | ⭐⭐⭐⭐ Complex | ✅ Yes | ✅ Yes |
| **4. ID + Salt** | 🔒🔒 High | ⭐⭐ Fair | ⭐⭐⭐ Medium | ✅ Yes | ❌ No |
| **5. Username** | 🔒 Very Low | ⭐⭐⭐⭐⭐ Excellent | ⭐ Simple | ✅ Yes | ❌ No |

---

## Recommendation Matrix

### For Consumer App (Simple UX Priority)
**→ Option 1: Credential ID**
- Best balance of security and UX
- No extra user input
- Works seamlessly with iCloud Keychain

### For High-Security Wallet
**→ Option 2: Credential ID + Password**
- Additional security layer
- Acceptable UX for crypto users
- No server dependency

### For Enterprise/Managed Service
**→ Option 3: Server KMS**
- Professional key management
- Recovery features
- Audit trail

### For Self-Custody Purists
**→ Option 4: Credential ID + Salt**
- No server trust required
- Full user control
- Manual but secure

### For Demo/Testing Only
**→ Option 5: Username**
- DO NOT use in production
- Quick prototype only

---

## My Recommendation

**For FaceWallet, I recommend Option 1: Credential ID as Seed**

### Why?
1. ✅ Achieves your goal (same signature)
2. ✅ Best UX (no extra steps)
3. ✅ Works with iCloud Keychain sync
4. ✅ Simple to implement
5. ✅ No backend required
6. ⚠️ Security trade-off is acceptable for this use case

### Implementation Steps
1. Remove PRF-based key derivation
2. Use `keccak256(credentialId)` for private key
3. Update both `register()` and `authenticate()`
4. Test on multiple devices
5. Document the security model

Would you like me to implement Option 1 now?
