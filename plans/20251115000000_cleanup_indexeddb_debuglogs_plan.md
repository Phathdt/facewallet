# FaceWallet Cleanup Implementation Plan

**Date:** 2025-11-15
**Task:** Remove IndexedDB dependency, debug logs, and update documentation
**Status:** In Progress

## Context

User correctly identified that IndexedDB only works within one browser. Since passkeys sync via iCloud/Google Keychain automatically, we don't need IndexedDB for credential storage. The PIN-based approach means:
- Passkey syncs via iCloud/Google
- User memorizes PIN (not stored anywhere)
- No need for IndexedDB credential storage
- Each browser session authenticates independently

## Implementation Tasks

### Task 1: Remove IndexedDB Dependency ✅

**Files to modify:**

1. **`src/lib/passkey/PasskeyECDSASigner.ts`**
   - [x] Remove `PasskeyStorage` import (line 2)
   - [x] Remove `this.storage` property (line 6, 10)
   - [x] Remove all `storage.saveCredential()` calls (lines 201, 335-340)
   - [x] Remove all `storage.getCredential()` calls (lines 246, 309-312)
   - [x] Remove credential persistence logic
   - [x] Update `register()` - remove IndexedDB storage
   - [x] Update `authenticate()` - remove IndexedDB lookup, use conditional UI
   - [x] Remove `hasPasskeyForAddress()` method (lines 363-366)
   - [x] Remove `getCredentialForAddress()` method (lines 368-375)
   - [x] Remove `getStoredCredentials()` method (lines 377-382)
   - [x] Remove `deleteCredential()` method (lines 384-389)

2. **`src/lib/passkey/storage.ts`**
   - [x] Delete entire file (not needed)

3. **`src/lib/passkey/types.ts`**
   - [x] Remove `PasskeyCredential` type (lines 1-6)
   - [x] Keep only `SignerConfig` type

4. **Update PasskeyECDSASigner logic:**
   - [x] Simplified `register()` - no IndexedDB storage
   - [x] Simplified `authenticate()` - use browser's passkey picker with conditional UI
   - [x] Remove PIN verification logic that relied on stored addresses

### Task 2: Remove All Debug Logs ✅

**Files to clean:**

1. **`src/lib/passkey/PasskeyECDSASigner.ts`**
   - [x] Remove constructor logging (lines 25-39)
   - [x] Remove registration logging (lines 108-115, 128, 158, 179-191)
   - [x] Remove authentication logging (lines 238-243, 280, 286, 315-331)
   - [x] Remove error logging (lines 209-216, 349-356)

2. **`src/App.tsx`**
   - [x] Remove environment variable logging (lines 24-33)
   - [x] Remove debug useEffect (lines 24-33)

3. **`src/components/PasskeyManager.tsx`**
   - [x] Remove console.error in catch blocks (lines 43, 68)

4. **`src/components/SignMessage.tsx`**
   - [x] Remove debug console.log (lines 59-75)
   - [x] Remove console.error in catch blocks (lines 33, 79)

5. **`src/components/DebugInfo.tsx`**
   - [x] Delete entire component
   - [x] Remove import from App.tsx (line 15)
   - [x] Remove usage in App.tsx (line 37)

### Task 3: Update README.md ✅

**Add comprehensive section:** "Research & Implementation Journey"

Content includes:
- [x] The challenge of cross-device signature consistency
- [x] Why PRF outputs differ per device
- [x] Solution: PIN-based deterministic key derivation
- [x] How it works (detailed flow)
- [x] Why no IndexedDB needed
- [x] Security model and trade-offs
- [x] Alternative approaches comparison table
- [x] Browser compatibility matrix
- [x] Vercel RP ID handling
- [x] Key learnings
- [x] Future enhancements

### Task 4: Clean Up Deprecated Files ✅

Files to delete:
- [x] `src/lib/passkey/storage.ts`
- [x] `src/components/DebugInfo.tsx`
- [x] Check for `PASSKEY_FIX.md` (if exists)
- [x] Check for `SIGNATURE_CONSISTENCY_OPTIONS.md` (if exists)

### Task 5: Update Context Files ✅

**`src/contexts/PasskeyContext.tsx`**
- [x] Remove calls to `signer.hasPasskeyForAddress()`
- [x] Update passkey checking logic to rely on browser's credential manager
- [x] Simplify authentication flow

### Task 6: Final Review and Testing ✅

Quality checks:
- [x] Search entire codebase for remaining console.log
- [x] Verify no imports of deleted files
- [x] Run TypeScript compiler check
- [x] Run ESLint
- [x] Test build process
- [x] Verify all imports are valid

### Task 7: Git Commit and Push ✅

- [x] Add all changes to git
- [x] Create comprehensive commit message with breaking change notice
- [x] Push to main branch

## Breaking Changes

**IMPORTANT:** This is a breaking change. Users will need to re-create passkeys after this update because:
- IndexedDB storage is removed
- Passkeys now rely entirely on browser's built-in sync mechanism
- Old stored credentials in IndexedDB will no longer be used

## Success Criteria

1. ✅ No references to IndexedDB or PasskeyStorage
2. ✅ No console.log/console.error debug statements
3. ✅ README contains comprehensive research documentation
4. ✅ All deprecated files deleted
5. ✅ Code compiles without errors
6. ✅ Linting passes
7. ✅ Build succeeds
8. ✅ Passkey creation works without IndexedDB
9. ✅ Authentication uses browser's passkey picker

## Session Notes

- Implementation focuses on removing unnecessary storage layer
- Passkeys sync automatically via platform (iCloud/Google)
- PIN provides deterministic key derivation across devices
- Browser's built-in credential manager handles passkey selection
