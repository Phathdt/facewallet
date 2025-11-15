# Passkey Signature Inconsistency Investigation Plan

**Created**: 2025-11-15
**Agent**: planner-researcher
**Task**: Investigate why same passkey synced via iCloud produces different signatures across devices

## Problem Statement

User reports that the same passkey (synced via iCloud) produces **different signatures** when signing the same message on:
- Chrome on Mac
- iPhone Safari

**Expected**: Same passkey + same message = same signature
**Actual**: Same passkey + same message = different signatures

## Root Cause Hypotheses

### Hypothesis 1: PRF is Device-Specific (Most Likely)
**Theory**: WebAuthn PRF (Pseudo-Random Function) extension generates device-specific outputs, not credential-specific outputs.

**Evidence**:
- Each device has its own TPM/Secure Enclave
- PRF may use device-specific secrets that don't sync
- iCloud syncs credential metadata, not cryptographic secrets

**Implication**: This is **expected behavior** per WebAuthn spec

### Hypothesis 2: iCloud Syncs Credential but Not PRF Secret (Related to H1)
**Theory**: iCloud Keychain syncs the passkey credential ID and public key, but the PRF evaluation happens locally using device-specific secrets.

**Evidence**:
- Apple's security model keeps cryptographic operations in Secure Enclave
- PRF secrets would be hardware-bound for security

**Implication**: Different PRF outputs → Different derived private keys → Different signatures

### Hypothesis 3: Implementation Bug (Least Likely)
**Theory**: Our implementation or browser inconsistency causes different PRF outputs.

**Evidence Required**: Need to verify if PRF spec guarantees same output across devices

## Investigation Tasks

### Phase 1: Add Diagnostic Logging

#### Task 1.1: PRF Output Logging
**File**: `/Users/phathdt/Documents/Dev/facewallet/src/lib/passkey/PasskeyECDSASigner.ts`

Add logging in both `register()` and `authenticate()` methods after getting PRF output:

```typescript
// After line 157 in register() and line 261 in authenticate()
const prfOutput = extensionResults.prf?.results?.first

if (!prfOutput) {
  throw new Error('PRF extension not supported or failed')
}

// DEBUG: Log PRF output
const prfHex = Buffer.from(prfOutput).toString('hex')
console.log('=== PRF Output Debug ===')
console.log('PRF Output (hex):', prfHex)
console.log('PRF Output (first 16 chars):', prfHex.substring(0, 16))
console.log('PRF Output length:', prfOutput.byteLength)
console.log('PRF Salt used:', this.config.prfSalt)
console.log('Device info:', {
  userAgent: navigator.userAgent,
  platform: navigator.platform,
})
console.log('=======================')
```

#### Task 1.2: Derived Wallet Logging
**File**: Same as above

Add logging after deriving the wallet:

```typescript
// After line 169 in register() and line 273 in authenticate()
const wallet = new ethers.Wallet(privateKeyHex)

// DEBUG: Log derived wallet info
console.log('=== Derived Wallet Debug ===')
console.log('Private Key (first 10 chars):', privateKeyHex.substring(0, 10) + '...')
console.log('Ethereum Address:', wallet.address)
console.log('Public Key:', wallet.publicKey)
console.log('============================')
```

#### Task 1.3: Message Signing Logging
**File**: `/Users/phathdt/Documents/Dev/facewallet/src/components/SignMessage.tsx`

Add logging in `handleSignWithPasskey()`:

```typescript
// Before line 52 (signing)
console.log('=== Message Signing Debug ===')
console.log('Message to sign:', message)
console.log('Message length:', message.length)
console.log('Message bytes:', new TextEncoder().encode(message))
console.log('Wallet address:', wallet.address)
console.log('=============================')

const sig = await wallet.signMessage(message)

// After signing
console.log('=== Signature Result ===')
console.log('Signature:', sig)
console.log('Signature length:', sig.length)
console.log('========================')
```

### Phase 2: Create Signature Comparison Tool

#### Task 2.1: Create SignatureCompare Component
**File**: `/Users/phathdt/Documents/Dev/facewallet/src/components/SignatureCompare.tsx` (NEW)

Create a UI component to compare signatures from different devices:

```typescript
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, XCircle, Copy } from 'lucide-react'

export function SignatureCompare() {
  const [device1Sig, setDevice1Sig] = useState('')
  const [device2Sig, setDevice2Sig] = useState('')
  const [device1Info, setDevice1Info] = useState('')
  const [device2Info, setDevice2Info] = useState('')
  const [compared, setCompared] = useState(false)

  const compare = () => {
    console.log('=== Signature Comparison ===')
    console.log('Device 1 Signature:', device1Sig)
    console.log('Device 2 Signature:', device2Sig)
    console.log('Are identical:', device1Sig === device2Sig)
    console.log('============================')
    setCompared(true)
  }

  const reset = () => {
    setDevice1Sig('')
    setDevice2Sig('')
    setDevice1Info('')
    setDevice2Info('')
    setCompared(false)
  }

  const areIdentical = device1Sig === device2Sig && device1Sig !== ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signature Comparison Tool</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-600">
            Device 1 (Chrome Mac):
          </label>
          <Textarea
            value={device1Sig}
            onChange={(e) => setDevice1Sig(e.target.value)}
            placeholder="Paste signature from Chrome Mac..."
            className="font-mono text-xs"
          />
          <input
            type="text"
            value={device1Info}
            onChange={(e) => setDevice1Info(e.target.value)}
            placeholder="Device info (optional)"
            className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-600">
            Device 2 (iPhone Safari):
          </label>
          <Textarea
            value={device2Sig}
            onChange={(e) => setDevice2Sig(e.target.value)}
            placeholder="Paste signature from iPhone..."
            className="font-mono text-xs"
          />
          <input
            type="text"
            value={device2Info}
            onChange={(e) => setDevice2Info(e.target.value)}
            placeholder="Device info (optional)"
            className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={compare}
            disabled={!device1Sig || !device2Sig}
            className="flex-1"
          >
            Compare Signatures
          </Button>
          <Button onClick={reset} variant="outline">
            Reset
          </Button>
        </div>

        {compared && device1Sig && device2Sig && (
          <div
            className={`mt-4 rounded border p-4 ${
              areIdentical
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-center gap-2">
              {areIdentical ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="font-bold text-green-700">IDENTICAL</p>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <p className="font-bold text-red-700">DIFFERENT</p>
                </>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-700">
              {areIdentical
                ? 'Both devices produced the same signature. PRF output is consistent across devices.'
                : 'Signatures are different. This indicates device-specific PRF outputs or different private keys.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

#### Task 2.2: Add to Main App
**File**: Update the main page to include SignatureCompare component

### Phase 3: Research WebAuthn PRF Behavior

#### Task 3.1: Research PRF Specification
Research and document:

1. **WebAuthn PRF Extension Spec**
   - Read W3C WebAuthn Level 3 spec for PRF
   - Understand if PRF output should be deterministic across devices
   - Check if PRF is credential-bound or device-bound

2. **Apple's iCloud Keychain Sync**
   - What data syncs via iCloud for passkeys?
   - Does PRF secret sync or stay local?
   - Security model for Secure Enclave

3. **FIDO2/WebAuthn Best Practices**
   - Expected behavior for key derivation
   - Device-specific vs credential-specific secrets

#### Task 3.2: Document Findings
**File**: `/Users/phathdt/Documents/Dev/facewallet/docs/webauthn-prf-investigation.md` (NEW)

Create comprehensive documentation of findings

### Phase 4: Testing and Verification

#### Task 4.1: Test on Chrome Mac
1. Clear all passkeys
2. Create new passkey
3. Sign message "Hello World"
4. Record:
   - PRF output (first 16 chars)
   - Derived wallet address
   - Signature

#### Task 4.2: Test on iPhone Safari
1. Wait for iCloud sync (or force sync)
2. Same passkey should appear
3. Sign same message "Hello World"
4. Record:
   - PRF output (first 16 chars)
   - Derived wallet address
   - Signature

#### Task 4.3: Compare Results
Use SignatureCompare tool to verify if signatures match

### Phase 5: Determine Solution

#### If PRF is Device-Specific (Expected Behavior):
**Action**: Update documentation and user communication

**Changes Required**:
1. Update README to explain passkeys are device-specific for signing
2. Add warning in UI that passkey on Mac != passkey on iPhone for signing
3. Consider alternative approaches:
   - Sync the derived private key separately (less secure)
   - Use different mechanism for cross-device signing
   - Accept device-specific signing keys as feature

#### If PRF Should Be Consistent (Bug):
**Action**: Fix implementation

**Potential Fixes**:
1. Ensure same PRF salt is used across devices
2. Check if rpId consistency affects PRF
3. Verify credential ID is properly stored/retrieved
4. Check for browser-specific PRF implementation differences

## Success Criteria

1. Understand root cause of different signatures
2. Determine if behavior is expected or bug
3. Provide clear documentation of findings
4. Recommend path forward (accept or fix)
5. Update user-facing documentation if needed

## Timeline

- Phase 1: 30 minutes (add logging)
- Phase 2: 30 minutes (comparison tool)
- Phase 3: 1 hour (research)
- Phase 4: 30 minutes (testing)
- Phase 5: 1 hour (solution/documentation)

**Total**: ~3.5 hours

## Dependencies

- Access to Chrome on Mac
- Access to iPhone with same iCloud account
- Browser console access on both devices
- WebAuthn documentation

## Deliverables

1. Enhanced PasskeyECDSASigner.ts with diagnostic logging
2. SignatureCompare component
3. Test results from both devices
4. Research documentation
5. Recommendation document
6. Updated user documentation (if needed)
7. Session summary with findings
