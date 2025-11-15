# Implementation Plan: PIN-Based Private Key Derivation

**Task**: Implement PIN-based private key derivation for cross-device signature consistency in FaceWallet
**Created**: 2025-11-15 17:42:10
**Status**: In Progress

---

## Problem Statement

Current issue: PRF output is device-specific, causing different signatures across devices (Chrome Mac, iPhone) even with the same iCloud-synced passkey.

**Solution**: Use PIN + Credential ID for deterministic key derivation while keeping PRF for biometric authentication.

---

## Architecture Overview

### Two-Layer Security Model

**Layer 1: Biometric Authentication (PRF)**
- WebAuthn PRF extension requires biometric verification
- Protects against unauthorized passkey access
- Works with Face ID, Touch ID, Windows Hello

**Layer 2: PIN-Based Key Derivation**
- Private key derived from: `keccak256(credential_id + pin)`
- Same passkey + same PIN = same private key across all devices
- Passkey syncs via iCloud/Google, PIN memorized by user

---

## Implementation Tasks

### Task 1: Update PasskeyECDSASigner.ts
**File**: `/Users/phathdt/Documents/Dev/facewallet/src/lib/passkey/PasskeyECDSASigner.ts`

#### Subtask 1.1: Add PIN parameter to register() method
- [x] Import `keccak256` and `concat` from ethers
- [ ] Add `pin: string` parameter to register() method signature
- [ ] Validate PIN is 6 digits
- [ ] Keep existing PRF credential creation (biometric security)
- [ ] Add PIN-based key derivation after credential creation
- [ ] Derive private key: `keccak256(concat([credentialIdBytes, pinBytes]))`
- [ ] Create wallet from derived private key
- [ ] Store wallet address in credential data for PIN verification
- [ ] Add debug logging for PIN-based derivation

**Code changes**:
```typescript
// Method signature
async register(walletAddress: string, pin: string): Promise<{...}>

// PIN validation
if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
  throw new Error('PIN must be exactly 6 digits')
}

// PIN-based key derivation (after PRF credential creation)
const credentialIdBytes = new Uint8Array(credential.rawId)
const pinBytes = new TextEncoder().encode(pin)
const combined = concat([credentialIdBytes, pinBytes])
const privateKeyHex = keccak256(combined)
const wallet = new ethers.Wallet(privateKeyHex)

// Store derived address for verification
const credentialData: PasskeyCredential = {
  credentialId: this.bufferToBase64(credential.rawId),
  address: wallet.address, // Store derived address (not walletAddress)
  username: truncatedAddress,
  createdAt: Date.now(),
}
```

#### Subtask 1.2: Add PIN parameter to authenticate() method
- [ ] Add `pin: string` parameter to authenticate() method signature
- [ ] Validate PIN is 6 digits
- [ ] Keep existing PRF authentication (biometric security)
- [ ] Add PIN-based key derivation (same as register)
- [ ] Derive private key: `keccak256(concat([credentialIdBytes, pinBytes]))`
- [ ] Create wallet from derived private key
- [ ] Add PIN verification by comparing derived address with stored address
- [ ] Throw error if PIN is incorrect (addresses don't match)
- [ ] Add debug logging for PIN-based derivation

**Code changes**:
```typescript
// Method signature
async authenticate(walletAddress: string, pin: string): Promise<{...}>

// PIN validation
if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
  throw new Error('PIN must be exactly 6 digits')
}

// PIN-based key derivation (after PRF authentication)
const credId = this.bufferToBase64(assertion.rawId)
const credentialId = this.base64ToBuffer(credId)
const credentialIdBytes = new Uint8Array(credentialId)
const pinBytes = new TextEncoder().encode(pin)
const combined = concat([credentialIdBytes, pinBytes])
const privateKeyHex = keccak256(combined)
const wallet = new ethers.Wallet(privateKeyHex)

// Verify PIN by checking address
const existingCred = await this.storage.getCredential(credId)
if (existingCred && existingCred.address !== wallet.address) {
  throw new Error('Incorrect PIN. Please try again.')
}
```

---

### Task 2: Update PasskeyContext.tsx
**File**: `/Users/phathdt/Documents/Dev/facewallet/src/contexts/PasskeyContext.tsx`

#### Subtask 2.1: Update PasskeyContextValue interface
- [ ] Add `pin: string` parameter to authenticate() method signature
- [ ] Update JSDoc comments

**Code changes**:
```typescript
interface PasskeyContextValue {
  hasPasskey: boolean
  isChecking: boolean
  isAuthenticated: boolean
  signer: PasskeyECDSASigner
  checkPasskey: () => Promise<void>
  refreshPasskey: () => void
  authenticate: (pin: string) => Promise<ethers.Wallet> // Add PIN parameter
  logout: () => void
}
```

#### Subtask 2.2: Update authenticate() implementation
- [ ] Add `pin: string` parameter
- [ ] Pass PIN to signer.authenticate()
- [ ] Update error handling for PIN errors

**Code changes**:
```typescript
const authenticate = useCallback(async (pin: string) => {
  if (!activeAddress) {
    throw new Error('No active address')
  }

  // Return cached wallet if already authenticated
  if (isAuthenticated && cachedWallet) {
    return cachedWallet
  }

  try {
    const result = await signer.authenticate(activeAddress, pin)
    setCachedWallet(result.wallet)
    setIsAuthenticated(true)
    return result.wallet
  } catch (error) {
    setIsAuthenticated(false)
    setCachedWallet(null)
    throw error
  }
}, [activeAddress, signer, isAuthenticated, cachedWallet])
```

---

### Task 3: Update PasskeyManager.tsx
**File**: `/Users/phathdt/Documents/Dev/facewallet/src/components/PasskeyManager.tsx`

#### Subtask 3.1: Add PIN state and UI
- [ ] Add PIN state: `const [pin, setPin] = useState('')`
- [ ] Import Input and Label components
- [ ] Add PIN input field with proper attributes
- [ ] Add PIN validation UI
- [ ] Clear PIN after successful operations

**Code changes**:
```typescript
const [pin, setPin] = useState('')

// PIN Input UI (add before buttons)
{!hasPasskey || !isAuthenticated ? (
  <div className="space-y-2">
    <Label htmlFor="pin">
      {!hasPasskey ? 'Create 6-digit PIN' : 'Enter your PIN'}
    </Label>
    <Input
      id="pin"
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      value={pin}
      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
      placeholder="Enter 6-digit PIN"
      className="text-center text-lg tracking-widest"
    />
    {error && (
      <p className="text-sm text-destructive">{error}</p>
    )}
  </div>
) : null}
```

#### Subtask 3.2: Update handleCreatePasskey
- [ ] Validate PIN length before creating passkey
- [ ] Pass PIN to signer.register()
- [ ] Clear PIN after success
- [ ] Handle PIN-related errors

**Code changes**:
```typescript
const handleCreatePasskey = async () => {
  if (!activeAddress) return
  if (pin.length !== 6) {
    setError('PIN must be 6 digits')
    return
  }

  try {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    await signer.register(activeAddress, pin)

    refreshPasskey()
    setSuccess('Passkey created successfully!')
    setPin('') // Clear PIN
    setTimeout(() => setSuccess(null), 3000)
  } catch (error: any) {
    setError(error.message)
  } finally {
    setIsLoading(false)
  }
}
```

#### Subtask 3.3: Update handleAuthenticate
- [ ] Validate PIN length before authenticating
- [ ] Pass PIN to authenticate()
- [ ] Clear PIN after success
- [ ] Handle PIN-related errors (incorrect PIN)

**Code changes**:
```typescript
const handleAuthenticate = async () => {
  if (!activeAddress) return
  if (pin.length !== 6) {
    setError('PIN must be 6 digits')
    return
  }

  try {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    await authenticate(pin)

    setSuccess('Passkey authenticated successfully!')
    setPin('') // Clear PIN
    setTimeout(() => setSuccess(null), 3000)
  } catch (error: any) {
    setError(error.message)
  } finally {
    setIsLoading(false)
  }
}
```

#### Subtask 3.4: Update button disabled states
- [ ] Disable Create Passkey button if PIN is not 6 digits
- [ ] Disable Authenticate button if PIN is not 6 digits

**Code changes**:
```typescript
<Button
  onClick={handleCreatePasskey}
  disabled={isLoading || pin.length !== 6}
  className="w-full"
>
  {isLoading ? 'Creating...' : 'Create Passkey with PIN'}
</Button>

<Button
  onClick={handleAuthenticate}
  disabled={isLoading || pin.length !== 6}
  className="w-full"
>
  {isLoading ? 'Authenticating...' : 'Authenticate with PIN'}
</Button>
```

---

### Task 4: Add Debug Logging (Optional)
**File**: `/Users/phathdt/Documents/Dev/facewallet/src/lib/passkey/PasskeyECDSASigner.ts`

- [ ] Add console logs in register() to show PIN-based derivation
- [ ] Add console logs in authenticate() to show PIN-based derivation
- [ ] Log: Credential ID (first 20 chars), PIN length, Derived Address

**Code changes**:
```typescript
console.log('=== PIN-Based Key Derivation ===')
console.log('Credential ID (hex):', Buffer.from(credentialIdBytes).toString('hex').substring(0, 20) + '...')
console.log('PIN length:', pin.length)
console.log('Derived Private Key (first 10 chars):', privateKeyHex.substring(0, 10) + '...')
console.log('Derived Address:', wallet.address)
console.log('================================')
```

---

### Task 5: Update Documentation
**File**: `/Users/phathdt/Documents/Dev/facewallet/README.md`

- [ ] Add section: "How PIN-Based Signing Works"
- [ ] Explain two-layer security model
- [ ] Document security trade-offs
- [ ] Add user flow diagrams
- [ ] Add cross-device flow example

---

### Task 6: Testing
- [ ] Build project: `npm run build`
- [ ] Test on Chrome Mac: Create passkey with PIN "123456"
- [ ] Verify: Sign message and record signature
- [ ] Test on iPhone: Authenticate with same PIN "123456"
- [ ] Verify: Sign same message and compare signatures
- [ ] Test: Wrong PIN should show error "Incorrect PIN"
- [ ] Test: Non-numeric PIN should be rejected
- [ ] Test: PIN < 6 digits should disable buttons

---

### Task 7: Code Review
- [ ] Delegate to `code-reviewer` agent
- [ ] Review implementation against plan
- [ ] Check TypeScript types
- [ ] Verify error handling
- [ ] Check security considerations

---

### Task 8: Session Summary
- [ ] Save session summary to `.claude_sessions/frontend-developer/`
- [ ] Document key findings and decisions
- [ ] Note any issues or recommendations

---

## Security Considerations

### Strengths
- Biometric protects credential access (Layer 1)
- PIN protects private key derivation (Layer 2)
- Both required to sign transactions
- No private keys stored anywhere
- PIN is client-side only (never sent to server)

### Trade-offs
- PIN must be memorized (not synced like passkey)
- Wrong PIN = different wallet (mitigated by address verification)
- Credential ID visible in IndexedDB (PIN adds security layer)
- User must write down PIN securely (like seed phrase)

### PIN Verification
- Store derived wallet address in IndexedDB
- On authentication, derive wallet from PIN and compare addresses
- Reject if addresses don't match (incorrect PIN)
- User-friendly error: "Incorrect PIN. Please try again."

---

## User Experience Flow

### Registration Flow
1. User enters/connects Ethereum address
2. User clicks "Create Passkey"
3. User sees PIN input: "Create 6-digit PIN"
4. User enters PIN (e.g., "123456")
5. Browser shows biometric prompt
6. User authenticates with Face ID/Touch ID
7. Passkey created successfully

### Authentication Flow
1. User has existing passkey
2. User clicks "Authenticate Passkey"
3. User sees PIN input: "Enter your PIN"
4. User enters PIN (e.g., "123456")
5. Browser shows biometric prompt
6. User authenticates with Face ID/Touch ID
7. Wallet unlocked successfully

### Cross-Device Flow
1. User on iPhone (passkey synced from Mac)
2. User enters same PIN used on Mac
3. Biometric authentication (Face ID)
4. Same credential ID + same PIN = same private key
5. Signs message → Same signature as Mac

---

## Deliverables

1. [x] Implementation plan created
2. [ ] Updated PasskeyECDSASigner with PIN support
3. [ ] Updated PasskeyContext with PIN parameter
4. [ ] Updated PasskeyManager with PIN input UI
5. [ ] Debug logging added
6. [ ] Documentation updated
7. [ ] Build and test on production
8. [ ] Code review completed
9. [ ] Session summary saved

---

## Notes

- PIN input must be numeric-only (type="password", inputMode="numeric")
- Validate PIN is exactly 6 digits before allowing submit
- Clear PIN from input after successful authentication (security)
- Consider adding "Forgot PIN?" flow (would require account recreation)
- User should write down PIN in secure location (like seed phrase)
- PIN is NOT synced via iCloud (intentional - adds security layer)

---

## Next Steps

1. Implement Task 1: Update PasskeyECDSASigner.ts
2. Implement Task 2: Update PasskeyContext.tsx
3. Implement Task 3: Update PasskeyManager.tsx
4. Add debug logging
5. Update documentation
6. Build and test
7. Code review
8. Deploy to production

---

**End of Plan**
