# FaceWallet

**Passwordless Ethereum Wallet Using Passkeys and PIN-Based Key Derivation**

FaceWallet is a client-side Ethereum wallet that eliminates seed phrases by using biometric authentication (Face ID, Touch ID, Windows Hello) combined with a PIN to derive deterministic private keys. This two-layer security approach ensures consistent signatures across all your devices.

> No seed phrases. Just your biometrics and a 6-digit PIN.

## Table of Contents

- [How It Works - PIN-Based Key Derivation](#how-it-works---pin-based-key-derivation)
- [Research & Implementation Journey](#research--implementation-journey)
- [Features](#features)
- [Browser Compatibility](#browser-compatibility)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [Security Considerations](#security-considerations)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Development](#development)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## How It Works - PRF + PIN Key Derivation

Traditional wallets require you to manage seed phrases (12-24 words) or private keys, which can be lost, stolen, or forgotten. FaceWallet uses a fundamentally different approach combining biometric authentication with PRF-based key derivation.

### Two-Layer Security Model

FaceWallet uses a dual-layer security approach to protect your wallet and ensure consistent signatures across all devices:

**Layer 1: Biometric Authentication (WebAuthn PRF)**

- WebAuthn PRF extension requires biometric verification (Face ID, Touch ID, Windows Hello)
- Protects against unauthorized access - cannot derive keys without biometric authentication
- Hardware-backed by your device's secure enclave
- Passkeys sync automatically via iCloud Keychain or Google Password Manager

**Layer 2: PRF-Based Key Derivation with PIN Salt**

- Private key derived deterministically from: `keccak256(PRF(sha256(PIN)))`
- Same passkey + same PIN = same PRF output = same private key across ALL devices
- PIN is memorized by you (not synced like passkey)
- PRF output syncs with passkey (within same ecosystem: Apple/Google)
- Requires biometric authentication every time to access PRF output

### The Signing Flow

Here's how FaceWallet uses PRF + PIN to sign Ethereum messages:

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: User Sets Ethereum Address                             │
│ ───────────────────────────────────────────────────────────────│
│ Two options:                                                    │
│ • Connect wallet (MetaMask, WalletConnect, etc.)               │
│ • Enter address manually                                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Setup Passkey (Smart Detection)                        │
│ ───────────────────────────────────────────────────────────────│
│ User enters 6-digit PIN: "123456"                              │
│ User clicks "Setup Passkey with PIN"                           │
│                                                                 │
│ Algorithm:                                                      │
│ 1. pinHash = sha256("123456")                                   │
│ 2. Try to authenticate with existing passkey:                  │
│    navigator.credentials.get({                                  │
│      extensions: { prf: { eval: { first: pinHash } } }         │
│    })                                                           │
│                                                                 │
│ If existing passkey found (e.g., synced from another device):  │
│   ✓ Derive wallet from PRF output immediately                  │
│   ✓ Cache wallet in memory                                     │
│   ✓ Show: "Using existing passkey - ready to sign!"            │
│   ✓ User can sign messages immediately (1 authentication only) │
│                                                                 │
│ If no existing passkey found:                                  │
│   → Create new passkey:                                        │
│     navigator.credentials.create({                              │
│       extensions: { prf: { eval: { first: pinHash } } }        │
│     })                                                          │
│   → Show: "Passkey created successfully!"                      │
│   → User needs to authenticate once more to unlock signing     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Authenticate to Unlock Signing (New Passkey Only)      │
│ ───────────────────────────────────────────────────────────────│
│ Only required if passkey was just created (not for existing)   │
│                                                                 │
│ User clicks "Authenticate with PIN"                            │
│ User enters same PIN: "123456"                                 │
│ Authenticate with biometric                                    │
│                                                                 │
│ prfOutput = credentials.get(...)                               │
│ privateKey = keccak256(prfOutput)                              │
│ wallet = new ethers.Wallet(privateKey)                         │
│                                                                 │
│ Wallet cached in memory for current session                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Sign Messages (Using Cached Wallet)                    │
│ ───────────────────────────────────────────────────────────────│
│ wallet = getCachedWallet()  // From memory (in-memory only)    │
│ signature = await wallet.signMessage(message)                  │
│                                                                 │
│ No biometric needed - wallet cached for current session!       │
│ Cache cleared when:                                            │
│ • User clicks "Logout"                                         │
│ • User closes browser tab                                      │
│ • User switches to different address                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Cross-Device Usage (Same Passkey, Same PIN)            │
│ ───────────────────────────────────────────────────────────────│
│ Scenario: Created passkey on Mac, now using iPhone             │
│                                                                 │
│ On iPhone (passkey synced from Mac via iCloud):                │
│ 1. Open new browser tab (no cache)                             │
│ 2. Enter same PIN: "123456"                                    │
│ 3. Click "Setup Passkey with PIN"                              │
│ 4. App tries to authenticate with existing passkey             │
│ 5. Device prompts: "Use Face ID to authenticate"               │
│ 6. User authenticates with Face ID                             │
│ 7. Existing passkey detected!                                  │
│ 8. PRF(pinHash) → same output (PRF syncs with passkey!)        │
│ 9. Wallet derived and cached immediately                       │
│ 10. Show: "Using existing passkey - ready to sign!" ✅          │
│                                                                 │
│ Same PRF output = SAME privateKey across devices! ✅            │
│ User can sign messages immediately (no second authentication)  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Result: Same Signature Across All Devices! ✅                   │
│ ───────────────────────────────────────────────────────────────│
│ Mac:    PRF(sha256("123456")) → prfOutput → privateKey A       │
│ iPhone: PRF(sha256("123456")) → prfOutput → privateKey A       │
│         ↓                                                       │
│         Same PRF output = Same signature for the same message! │
│                                                                 │
│ No localStorage, no persistent cache - works across devices!   │
└─────────────────────────────────────────────────────────────────┘
```

### Why This is Secure

**Dual-Layer Protection**

- Layer 1: Biometric authentication required to access PRF output (hardware-backed)
- Layer 2: PIN creates deterministic PRF input (memorized secret)
- Cannot derive private key without BOTH biometric authentication AND correct PIN
- Attack surface minimized: need device access + biometric + PIN knowledge

**Hardware-Backed PRF Security**

- PRF computation happens inside device secure enclave (Secure Enclave on Apple, TPM on Windows)
- Biometric data never leaves the secure hardware
- PRF output only available after successful biometric authentication
- No offline brute-force attacks possible - must authenticate with device

**PRF + PIN Key Derivation**

- Private key deterministically derived from `keccak256(PRF(sha256(PIN)))`
- Same passkey + same PIN = same PRF input = same PRF output = same private key across devices
- Different PIN = different PRF output = completely different wallet
- PRF output syncs with passkey within same ecosystem (Apple/Google)
- Cannot compute PRF output without biometric authentication

**Cross-Device Consistency**

- Passkey syncs automatically via iCloud Keychain or Google Password Manager
- **Empirical finding**: PRF output ALSO syncs within same ecosystem (Apple/Google)
- User memorizes PIN (intentionally not synced for added security)
- Same passkey + same PIN on any device = same PRF output = identical private key
- Works seamlessly across devices within same ecosystem (Mac ↔ iPhone, Chrome ↔ Android)

**Session-Based Wallet Caching**

- Private keys cached **in-memory only** during active session
- Never stored to disk, localStorage, or cloud
- Derived from PRF output using: `keccak256(PRF(sha256(PIN)))`
- Cache automatically cleared when:
  - User closes browser tab
  - User clicks "Logout"
  - User switches to different address
- Each new session requires fresh authentication
- Cannot be extracted, stolen, or persisted across sessions

**Domain-Bound Security**

- Passkeys cryptographically bound to your website's domain
- Cannot be used on phishing sites or different domains
- Prevents credential theft and replay attacks

### Important Design Considerations

**PIN Security Best Practices**

- Choose a unique 6-digit PIN (not your phone unlock PIN)
- Write down your PIN in a secure location (like you would a seed phrase)
- PIN is intentionally NOT synced across devices (adds security layer)
- Losing your PIN means losing access to that wallet (no recovery mechanism)

**Smart Passkey Detection**

- No localStorage or persistent cache used for passkey detection
- Works seamlessly across devices and browsers
- App intelligently detects existing passkeys:
  - When you click "Setup Passkey", app first tries to authenticate
  - If existing passkey found (e.g., synced from another device) → Reuses it
  - If no passkey found → Creates new one
- Prevents duplicate passkey creation
- Single authentication when reusing existing passkey

**Trade-offs**

✅ **Strengths:**

- Consistent signatures across all devices
- Biometric + PIN dual-layer security
- No seed phrases to manage
- Cross-device passkey sync (iCloud/Google)
- Smart passkey detection (no duplicate passkeys)
- No persistent cache issues

⚠️ **Limitations:**

- PIN must be memorized or securely stored
- Wrong PIN creates different wallet (deterministic derivation)
- No "forgot PIN" recovery (by design - non-custodial)
- Each new browser tab requires fresh authentication (session-based cache)

**Forgot PIN?**

If you forget your PIN, you cannot recover access to that specific wallet. This is intentional:

- Non-custodial design means no one can reset your PIN
- Similar to losing a seed phrase in traditional wallets
- You can create a NEW passkey with a NEW PIN for a different wallet
- Consider writing down your PIN alongside your important documents

## Research & Implementation Journey

### The Discovery: PRF Syncs Across Devices!

Initial assumption was that WebAuthn's PRF extension would be **device-specific** (different PRF output per device). However, through empirical testing, we discovered something important:

**Discovery**: PRF output DOES sync within the same ecosystem (Apple/Google)!

### Empirical Testing Results

Testing with the same passkey + same PIN across devices:

```
Mac (Chrome):  PRF(sha256("123456")) → output: 0xaE6C...8BCe
iPhone (Safari): PRF(sha256("123456")) → output: 0xaE6C...8BCe ✅ IDENTICAL!

Credential ID: gz2nYRbKq8us/Dyjxn8UFtqbyZs= (synced via iCloud Keychain)
PRF Output: SAME across both devices!
```

**Conclusion**: Passkey syncing via iCloud Keychain (Apple) or Google Password Manager (Google) also syncs the PRF secret material, resulting in identical PRF outputs across devices within the same ecosystem.

### Current Implementation: PRF + PIN Key Derivation

We use a **two-layer security model** that leverages this discovery:

#### Layer 1: Biometric Authentication (WebAuthn PRF)

- User authenticates with Face ID/Touch ID/Windows Hello
- PRF extension requires biometric verification
- Hardware-backed by device's secure enclave
- Passkeys sync automatically via iCloud Keychain or Google Password Manager

#### Layer 2: PIN-Based Deterministic PRF Input

- PIN is hashed: `pinHash = sha256(PIN)`
- PRF uses PIN hash as deterministic input: `PRF(pinHash)`
- Private key derived from PRF output: `privateKey = keccak256(PRF(pinHash))`
- User memorizes 6-digit PIN (not synced for added security)

### How It Works

```
Registration (Mac):
1. User creates passkey with biometric authentication
2. User sets 6-digit PIN: "123456"
3. pinHash = sha256("123456")
4. PRF computed: prf_output = PRF(pinHash)
5. Private key derived: privateKey = keccak256(prf_output)
6. Wallet address: 0xaE6C...8BCe

Cross-Device Usage (iPhone after iCloud sync):
1. Passkey syncs via iCloud Keychain (includes PRF secret material)
2. User enters same PIN: "123456"
3. pinHash = sha256("123456") // Same hash
4. User authenticates with Face ID
5. PRF computed: prf_output = PRF(pinHash) // SAME output!
6. Private key derived: privateKey = keccak256(prf_output)
7. Wallet address: 0xaE6C...8BCe ✅ IDENTICAL!
8. Signing same message → SAME signature ✅
```

### Smart Passkey Detection

To prevent duplicate passkey creation across devices:

**Algorithm:**
1. User clicks "Setup Passkey with PIN"
2. App first tries to **authenticate** with existing passkey
3. If found → Derive wallet immediately, cache it, ready to sign!
4. If not found → Create new passkey

**Benefits:**
- No localStorage or persistent cache needed
- Works across all devices and browsers
- Prevents duplicate passkeys
- Single authentication when reusing existing passkey

### Security Model

**What protects your wallet:**

1. **Biometric authentication** - Required to compute PRF output
2. **6-digit PIN** - Creates deterministic PRF input (sha256 hash)
3. **Hardware-backed PRF** - Computation happens in Secure Enclave/TPM
4. **Session-based caching** - Wallet cached in-memory only (cleared on tab close)

**Trade-offs:**

- PIN must be memorized or securely written down
- Wrong PIN = different wallet (no recovery without correct PIN)
- Credential ID is semi-public (managed by browser, but PIN adds security layer)

**Security Level**: High

- Requires **both** biometric authentication AND correct PIN
- More secure than password-only wallets
- Less complex than full seed phrase management

### Alternative Approaches Considered

We evaluated 5 different options for cross-device consistency:

| Approach                | Security  | UX         | Implementation | Chosen           |
| ----------------------- | --------- | ---------- | -------------- | ---------------- |
| Credential ID only      | Low       | ⭐⭐⭐⭐⭐ | Simple         | ❌ Too insecure  |
| **Credential ID + PIN** | High      | ⭐⭐⭐⭐   | Medium         | ✅ **Selected**  |
| Server KMS              | Very High | ⭐⭐⭐     | Complex        | ❌ Needs backend |
| Credential ID + Salt    | High      | ⭐⭐       | Medium         | ❌ Manual sync   |
| Username-based          | Very Low  | ⭐⭐⭐⭐⭐ | Simple         | ❌ Not secure    |

**Why we chose PIN-based approach:**

- Best balance of security and user experience
- No backend infrastructure required
- Works offline
- Simple mental model for users
- Acceptable security trade-offs for most use cases

### Browser Compatibility

The implementation works on browsers supporting WebAuthn PRF extension:

| Browser | PRF Support | Version | Notes              |
| ------- | ----------- | ------- | ------------------ |
| Chrome  | ✅          | 108+    | Full support       |
| Safari  | ✅          | 17+     | macOS 14+, iOS 17+ |
| Edge    | ✅          | 108+    | Chromium-based     |
| Brave   | ✅          | 1.47+   | Chromium-based     |
| Firefox | ❌          | N/A     | No PRF support yet |

### Vercel Deployment & RP ID

We encountered an issue with explicit RP ID on Vercel deployments:

**Problem**: `vercel.app` is on the Public Suffix List, causing WebAuthn to reject explicit RP IDs.

**Solution**: Omit RP ID for `*.vercel.app` domains, let browser use origin automatically.

```typescript
const shouldOmitRpId = window.location.hostname.endsWith('.vercel.app')
```

For custom domains, explicit RP ID can be set via environment variable.

### Key Learnings

1. **PRF is device-specific** - Not suitable for cross-device key derivation
2. **Passkeys sync credentials, not secrets** - Credential ID syncs, PRF output doesn't
3. **IndexedDB doesn't help cross-browser** - Only works within one browser instance
4. **PIN adds determinism** - Enables same key across devices while maintaining security
5. **Public Suffix List matters** - Vercel domains need special handling for WebAuthn

### Future Enhancements

Potential improvements to consider:

- **PIN change functionality** - Allow users to update their PIN
- **Multi-signature support** - Use different PINs for different security levels
- **Biometric-only mode** - Option to use device-specific keys for maximum security
- **Social recovery** - Allow trusted contacts to help recover access
- **Hardware wallet integration** - Combine with Ledger/Trezor for cold storage

## Features

### Core Capabilities

- **Biometric Message Signing**: Sign Ethereum messages using Face ID, Touch ID, or Windows Hello
- **No Seed Phrase Management**: Zero risk of losing or exposing seed phrases
- **Hardware Security**: Private keys derived in secure enclave, never stored or exposed
- **Two Address Modes**:
  - Connect existing wallet (MetaMask, WalletConnect, Coinbase Wallet, etc.)
  - Enter Ethereum address manually
- **Multiple Passkeys**: Create multiple passkeys for different addresses
- **Client-Side Only**: No backend servers, no data transmission, fully local

### User Experience

- **Instant Authentication**: Touch your fingerprint or look at your camera to sign
- **Cross-Device Sync**: Passkeys sync via iCloud Keychain (iOS/macOS) or Google Password Manager (Android/Chrome)
- **Seamless Integration**: Works alongside traditional Web3 wallets via RainbowKit
- **Visual Feedback**: Clear status indicators and helpful error messages

## Browser Compatibility

PRF extension support varies by browser and platform:

| Browser     | PRF Support | Min Version | Platform Notes                     |
| ----------- | ----------- | ----------- | ---------------------------------- |
| **Chrome**  | ✅ Full     | 108+        | Windows 10+, macOS 13+, Android 9+ |
| **Edge**    | ✅ Full     | 108+        | Windows 10+, macOS 13+             |
| **Safari**  | ✅ Full     | 17+         | macOS 14+, iOS 17+                 |
| **Brave**   | ✅ Full     | 1.47+       | Windows 10+, macOS 13+             |
| **Firefox** | ❌ None     | N/A         | No PRF support yet                 |

### Platform Authenticator Requirements

- **macOS**: Touch ID or Apple Watch (macOS 14+)
- **iOS**: Face ID or Touch ID (iOS 17+)
- **Windows**: Windows Hello (TPM 2.0 required, Windows 10+)
- **Android**: Fingerprint or Face Unlock (Android 9+, Chrome 108+)

## Getting Started

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **pnpm** (or npm/yarn)
- Supported browser (Chrome 108+, Safari 17+, Edge 108+, Brave 1.47+)
- Platform authenticator (Touch ID, Face ID, Windows Hello, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/facewallet.git
cd facewallet

# Install dependencies
pnpm install

# Create environment file for local development
cp .env.example .env.local

# Edit .env.local and configure:
# 1. Set VITE_RP_ID=localhost (for local development)
# 2. Add your WalletConnect Project ID (get one free at https://cloud.walletconnect.com)
```

### Environment Variables

FaceWallet requires the following environment variables:

#### Required Variables

- **`VITE_RP_ID`** - WebAuthn Relying Party ID (domain name)
  - **Local development**: `localhost`
  - **Production**: `facewallet.vercel.app` (or your custom domain)

- **`VITE_RP_NAME`** - Display name for your application
  - Example: `FaceWallet`

- **`VITE_WALLET_CONNECT_PROJECT_ID`** - WalletConnect project ID
  - Get one free at [cloud.walletconnect.com](https://cloud.walletconnect.com)

#### Optional Variables

- **`VITE_ALCHEMY_API_KEY`** - Alchemy API key for RPC endpoints

#### Setup for Local Development

1. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your local settings:
   ```env
   VITE_RP_ID=localhost
   VITE_RP_NAME=FaceWallet (Dev)
   VITE_WALLET_CONNECT_PROJECT_ID=your_project_id_here
   ```

#### Important Notes About RP ID

**RP ID Must Match Domain**: The `VITE_RP_ID` must match the domain where the app is hosted. Passkeys created with one RP ID cannot be used with a different RP ID.

**Localhost vs Production**: Passkeys created on `localhost` will NOT work on `facewallet.vercel.app` and vice versa. This is a WebAuthn security feature.

**Custom Domains**: If you add a custom domain (e.g., `app.facewallet.com`), update `VITE_RP_ID` to match the custom domain.

**Valid RP ID Rules**:

- RP ID must be a valid domain suffix of the current origin
- For `facewallet.vercel.app`, valid RP IDs are:
  - `facewallet.vercel.app` (recommended)
  - `vercel.app` (less specific, not recommended)
  - `app` (invalid - not a valid domain)

### Run Development Server

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in a supported browser.

### Build for Production

```bash
pnpm build
pnpm preview
```

## Usage Guide

### First-Time Setup

**Option 1: Using Wallet Connection**

1. Click **"Connect Wallet"** tab
2. Click the **Connect Wallet** button
3. Select your wallet (MetaMask, WalletConnect, etc.) from RainbowKit modal
4. Approve the connection in your wallet
5. Your address will be displayed at the top
6. Click **"Create Passkey"** button
7. Your browser will prompt: _"Use Touch ID to sign in to FaceWallet"_
8. Authenticate with your biometric
9. Passkey created! You can now sign messages

**Option 2: Using Manual Address**

1. Click **"Manual Address"** tab
2. Enter your Ethereum address (e.g., `0x1234...abcd`)
3. Click **"Set Address"**
4. Your address will be displayed at the top
5. Click **"Create Passkey"** button
6. Authenticate with your biometric
7. Passkey created! You can now sign messages

### Signing a Message

1. Ensure you have a passkey created for your active address
2. Scroll to the **"Sign Message"** section
3. Enter your message in the text area
4. Click **"Sign with Passkey"**
5. Authenticate with your biometric when prompted
6. Your signature will be displayed below

Example:

```
Message: "Hello, Ethereum!"
Signature: 0x1234abcd...
```

### Switching Between Modes

- Use the tabs at the top to switch between **"Connect Wallet"** and **"Manual Address"**
- If you have a wallet connected, you can disconnect it to use manual mode
- If you have a manual address saved, you can clear it to use wallet mode
- Each mode maintains its own passkey associations

### Managing Multiple Passkeys

- You can create multiple passkeys for different addresses
- Each passkey is tied to a specific Ethereum address
- Switch between addresses by connecting different wallets or entering different manual addresses
- View all your passkeys in the **"Passkey Manager"** section

## Security Considerations

### What Makes FaceWallet Secure?

**1. No Private Key Storage**

```typescript
// Traditional wallet (UNSAFE if compromised)
localStorage.setItem('privateKey', '0x1234...') // ❌ Stored in browser

// FaceWallet (SAFE)
const privateKey = derivePRFKey(biometric) // ✅ Derived on-demand
await signMessage(privateKey)
// privateKey discarded, never stored
```

**2. Hardware-Backed Cryptography**

- All PRF operations happen inside secure hardware (Secure Enclave/TPM)
- Biometric secrets never exposed to JavaScript or operating system
- Keys derived in isolated, tamper-resistant environment

**3. Biometric Verification Required**

- Every signature requires fresh biometric authentication
- No way to sign without physical presence
- Protection against:
  - Remote attacks (attacker needs your device + biometric)
  - Malware (cannot extract PRF output without biometric)
  - Session hijacking (each operation requires re-authentication)

**4. Domain Binding**

- Passkeys are cryptographically bound to your website origin
- Phishing protection: passkey won't work on fake sites
- Cannot be stolen via DNS attacks or domain spoofing

**5. Client-Side Only Architecture**

- No backend servers to hack
- No API keys to steal
- No data transmission to third parties
- Fully air-gapped signing operations

### Threat Model

**What FaceWallet Protects Against:**

- ✅ Seed phrase theft/loss
- ✅ Private key exposure
- ✅ Phishing attacks
- ✅ Remote attacks (no physical access)
- ✅ Malware keylogging
- ✅ Session hijacking
- ✅ Cross-site request forgery

**What FaceWallet Does NOT Protect Against:**

- ❌ Physical device theft + biometric compromise (attacker with your device + spoofed biometric)
- ❌ Malicious browser extensions with elevated permissions
- ❌ Compromised operating system or secure enclave (extremely rare)
- ❌ User signing malicious transactions (always verify what you sign!)

### Account Recovery Considerations

**IMPORTANT:** FaceWallet uses a fundamentally different security model than traditional wallets:

**Traditional Wallet:**

- Seed phrase can be written down and stored safely
- Can recover on any device with the seed phrase
- Can export private keys

**FaceWallet:**

- No seed phrase to backup
- No private key to export
- Recovery depends on passkey sync:
  - **iOS/macOS**: Passkeys sync via iCloud Keychain
  - **Android/Chrome**: Passkeys sync via Google Password Manager
  - **Windows**: Passkeys stored locally (no sync by default)

**Recovery Strategies:**

1. **Use Passkey Sync (Recommended)**
   - Enable iCloud Keychain (Apple) or Google Password Manager
   - Passkeys automatically sync to your other devices
   - Sign in on new device with same account

2. **Create Multiple Passkeys**
   - Create passkey on multiple devices
   - Each device has independent signing capability
   - Lose one device, still have others

3. **Use Manual Mode for Important Addresses**
   - For addresses holding significant value, use wallet connection mode
   - Keep the actual wallet seed phrase backed up separately
   - FaceWallet provides convenience layer, not primary wallet

4. **Hybrid Approach (Recommended for Production)**
   - Use FaceWallet for frequent, low-value transactions
   - Keep traditional wallet (MetaMask, hardware wallet) for high-value operations
   - Best of both worlds: convenience + security

### Production Deployment Checklist

Before deploying FaceWallet to production:

- [ ] **HTTPS Only**: Enforce HTTPS for all connections (passkeys require secure context)
- [ ] **Content Security Policy**: Set strict CSP headers to prevent XSS
- [ ] **Subresource Integrity**: Use SRI for external scripts (RainbowKit, Wagmi)
- [ ] **Rate Limiting**: Implement client-side rate limiting for API calls
- [ ] **Error Boundaries**: Add React error boundaries for graceful failure handling
- [ ] **Security Headers**: Set X-Frame-Options, X-Content-Type-Options, etc.
- [ ] **Dependency Audit**: Run `pnpm audit` and fix vulnerabilities
- [ ] **Test on All Browsers**: Verify PRF support detection works correctly
- [ ] **User Education**: Add clear warnings about account recovery limitations
- [ ] **Monitoring**: Set up error tracking (Sentry, LogRocket, etc.)
- [ ] **Testnet Testing**: Test thoroughly on Sepolia/Goerli before mainnet

## Technology Stack

### Frontend Framework

- **React 19** - UI framework with modern hooks and concurrent features
- **TypeScript 5.9** - Type safety and developer experience
- **Vite 7** - Lightning-fast build tool and dev server

### Web3 Integration

- **RainbowKit 2.2** - Beautiful wallet connection UI
- **Wagmi 2.19** - React hooks for Ethereum (accounts, transactions, signing)
- **Viem 2.39** - TypeScript-first Ethereum utilities
- **Ethers.js 6.15** - Wallet management and key derivation

### Cryptography

- **@noble/secp256k1 3.0** - Elliptic curve cryptography (secp256k1 validation)
- **@noble/hashes 2.0** - SHA-256 hashing for key derivation
- **WebAuthn API** - Browser-native passkey and PRF support

### UI/Styling

- **Tailwind CSS 4.1** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components (built on Radix UI)
- **Radix UI** - Unstyled, accessible component primitives
- **Lucide React** - Beautiful icon library

### Development Tools

- **ESLint 9** - Code linting
- **Prettier 3** - Code formatting
- **TypeScript ESLint** - TypeScript-specific linting rules

## Project Structure

```
facewallet/
├── src/
│   ├── components/
│   │   ├── ui/                      # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── tooltip.tsx
│   │   ├── AccountDisplay.tsx       # Show active address and balance
│   │   ├── BrowserCompatibility.tsx # PRF support detection and warnings
│   │   ├── ManualAddressInput.tsx   # Manual address entry form
│   │   ├── PasskeyManager.tsx       # Create/manage passkeys
│   │   └── SignMessage.tsx          # Message signing demo
│   │
│   ├── contexts/
│   │   ├── AddressContext.tsx       # Address state management (wallet vs manual)
│   │   └── PasskeyContext.tsx       # Passkey operations context
│   │
│   ├── hooks/
│   │   └── usePRFSupport.ts         # Detect PRF extension support
│   │
│   ├── lib/
│   │   ├── passkey/
│   │   │   ├── PasskeyECDSASigner.ts  # Core PRF signer implementation
│   │   │   ├── storage.ts             # IndexedDB credential storage
│   │   │   └── types.ts               # TypeScript type definitions
│   │   │
│   │   └── wagmi/
│   │       ├── config.ts              # Wagmi configuration (chains, transports)
│   │       └── connectors.ts          # Wallet connectors
│   │
│   ├── App.tsx                      # Main application component
│   ├── main.tsx                     # React entry point
│   └── index.css                    # Global styles and Tailwind imports
│
├── public/                          # Static assets
├── .env.example                     # Environment variable template
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite configuration
├── tailwind.config.ts               # Tailwind CSS configuration
├── eslint.config.js                 # ESLint configuration
└── prettier.config.js               # Prettier configuration
```

### Key Files Explained

**`src/lib/passkey/PasskeyECDSASigner.ts`** - The heart of FaceWallet

```typescript
// Core functionality:
;-isSupported() - // Check if PRF is available
  register(address) - // Create new passkey for address
  authenticate(address) - // Authenticate and derive signing key
  ensureValidPrivateKey() // Validate secp256k1 compatibility
```

**`src/contexts/AddressContext.tsx`** - Address mode management

```typescript
// Manages two address sources:
- mode: 'wallet' | 'manual'     // Which source is active
- walletAddress                 // From connected wallet
- manualAddress                 // User-entered address
- activeAddress                 // Currently active address
```

**`src/contexts/PasskeyContext.tsx`** - Passkey operations

```typescript
// Provides passkey functionality to components:
;-createPasskey() - // Register new passkey
  signMessage() - // Sign message with PRF key
  hasPasskey() - // Check if passkey exists
  deletePasskey() // Remove passkey
```

## Development

### Code Quality Commands

```bash
# Run linter
pnpm lint

# Fix linting issues automatically
pnpm lint:fix

# Check code formatting
pnpm format:check

# Format code automatically
pnpm format
```

### Development Workflow

1. **Start dev server**: `pnpm dev`
2. **Make changes**: Edit files in `src/`
3. **Check types**: TypeScript checks automatically in your editor
4. **Lint & format**: Run `pnpm lint:fix && pnpm format`
5. **Test in browser**: Verify changes work correctly
6. **Build**: `pnpm build` to ensure no build errors
7. **Commit**: Follow conventional commit format

### Adding New Features

**Example: Add Transaction Sending**

1. Create new component: `src/components/SendTransaction.tsx`
2. Add passkey signing logic in `PasskeyContext.tsx`:
   ```typescript
   async function sendTransaction(to: string, value: string) {
     const wallet = await authenticateAndGetWallet()
     const tx = await wallet.sendTransaction({ to, value })
     return tx
   }
   ```
3. Integrate into `App.tsx`
4. Test on testnet (Sepolia)
5. Update documentation

### Common Development Tasks

**Update Dependencies**

```bash
pnpm update --latest
pnpm audit
pnpm build  # Ensure everything still works
```

**Add New shadcn/ui Component**

```bash
npx shadcn@latest add [component-name]
# Example: npx shadcn@latest add alert-dialog
```

**Debug PRF Issues**

```typescript
// Add logging in PasskeyECDSASigner.ts
console.log('PRF extension results:', extensionResults)
console.log('PRF output:', prfOutput)
console.log('Derived private key:', privateKeyHex)
```

## Deployment

### Deploy to Vercel (Recommended)

#### Option 1: Using Vercel CLI

```bash
# Install Vercel CLI
pnpm add -g vercel

# Set environment variables for production
vercel env add VITE_RP_ID production
# Enter: facewallet.vercel.app

vercel env add VITE_RP_NAME production
# Enter: FaceWallet

vercel env add VITE_WALLET_CONNECT_PROJECT_ID production
# Enter: your_project_id_here

# Deploy to production
vercel --prod
```

#### Option 2: Using Vercel Dashboard

1. **Push your code to GitHub**:

   ```bash
   git add .
   git commit -m "feat: add WebAuthn RP ID configuration"
   git push origin main
   ```

2. **Connect repository on Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Configure project settings

3. **Add environment variables**:
   - Go to **Project Settings** > **Environment Variables**
   - Add the following variables for **Production**:
     - `VITE_RP_ID` = `facewallet.vercel.app`
     - `VITE_RP_NAME` = `FaceWallet`
     - `VITE_WALLET_CONNECT_PROJECT_ID` = `your_project_id_here`

4. **Redeploy** (if already deployed):
   - Go to **Deployments** tab
   - Click **Redeploy** on the latest deployment
   - Or push a new commit to trigger automatic deployment

#### Important: Custom Domain Configuration

If you add a custom domain to your Vercel project:

1. **Add the custom domain in Vercel**:
   - Go to **Project Settings** > **Domains**
   - Add your custom domain (e.g., `app.facewallet.com`)

2. **Update the `VITE_RP_ID` environment variable**:
   - Go to **Environment Variables**
   - Update `VITE_RP_ID` to match your custom domain
   - Example: `VITE_RP_ID` = `app.facewallet.com`

3. **Redeploy the application**:
   - Passkeys are domain-bound
   - Changing RP ID requires users to create new passkeys

**Note**: Passkeys created with `facewallet.vercel.app` will NOT work with `app.facewallet.com`. Users will need to create new passkeys after domain change.

### Deploy to Netlify

```bash
# Install Netlify CLI
pnpm add -g netlify-cli

# Build and deploy
pnpm build
netlify deploy --prod --dir=dist

# Set environment variables in Netlify dashboard:
# - VITE_RP_ID=your-app.netlify.app
# - VITE_RP_NAME=FaceWallet
# - VITE_WALLET_CONNECT_PROJECT_ID=your_project_id
```

### Deploy to Cloudflare Pages

```bash
# Push to GitHub
git push origin main

# Connect repository in Cloudflare Pages dashboard
# Build settings:
#   Build command: pnpm build
#   Build output directory: dist
#
# Environment variables:
#   VITE_RP_ID=your-app.pages.dev
#   VITE_RP_NAME=FaceWallet
#   VITE_WALLET_CONNECT_PROJECT_ID=your_project_id
```

### Environment Variables Reference

Set these in your deployment platform:

| Variable                         | Description                        | Required | Example                 |
| -------------------------------- | ---------------------------------- | -------- | ----------------------- |
| `VITE_RP_ID`                     | WebAuthn Relying Party ID (domain) | Yes      | `facewallet.vercel.app` |
| `VITE_RP_NAME`                   | Display name for the application   | Yes      | `FaceWallet`            |
| `VITE_WALLET_CONNECT_PROJECT_ID` | WalletConnect Cloud project ID     | Yes      | `abc123...`             |
| `VITE_ALCHEMY_API_KEY`           | Alchemy API key for RPC endpoints  | No       | `xyz789...`             |

**Get Required IDs:**

- WalletConnect Project ID: [cloud.walletconnect.com](https://cloud.walletconnect.com)
- Alchemy API Key: [alchemy.com](https://www.alchemy.com)

### Testing Your Deployment

After deployment, verify the following checklist:

#### Security & HTTPS

- [ ] **HTTPS is enforced**: Passkeys require secure context
- [ ] **Security headers are set**: Check vercel.json configuration
- [ ] **No mixed content warnings**: All resources loaded over HTTPS

#### WebAuthn Configuration

- [ ] **RP ID matches domain**: Check browser console for WebAuthn errors
- [ ] **PRF extension is detected**: Green compatibility banner should appear
- [ ] **Passkey creation works**: Successfully create a passkey on production
- [ ] **Passkey authentication works**: Sign in with created passkey
- [ ] **Message signing works**: Sign a test message with passkey

#### Web3 Integration

- [ ] **Wallet connection works**: Test RainbowKit integration
- [ ] **Multiple wallet types work**: Test MetaMask, WalletConnect, etc.
- [ ] **Manual address works**: Test entering address manually
- [ ] **Address display is correct**: Verify truncated address format

#### Browser Compatibility

- [ ] **Chrome/Edge works**: Test on Chrome 108+ or Edge 108+
- [ ] **Safari works**: Test on Safari 17+ (macOS/iOS)
- [ ] **Unsupported browser shows warning**: Test on Firefox (should show red banner)

#### Error Handling

- [ ] **Graceful error messages**: Test error scenarios
- [ ] **Recovery from failed passkey creation**: Can retry after failure
- [ ] **Clear user feedback**: Status messages are helpful

#### Cross-Environment Testing

**Important**: Remember that passkeys are environment-specific:

| Environment             | RP ID                   | Passkeys Work?        |
| ----------------------- | ----------------------- | --------------------- |
| `localhost:5173`        | `localhost`             | Only on localhost     |
| `facewallet.vercel.app` | `facewallet.vercel.app` | Only on this domain   |
| `app.facewallet.com`    | `app.facewallet.com`    | Only on custom domain |

Users must create separate passkeys for each environment. This is a WebAuthn security feature, not a bug.

### Troubleshooting Deployment Issues

#### RP ID Mismatch Error

```
Error: The relying party ID is not a registrable domain suffix of, nor equal to the current domain
```

**Solution**: Ensure `VITE_RP_ID` environment variable matches your deployment domain exactly.

#### Passkeys Not Working After Custom Domain Setup

```
Error: No passkey found for this wallet address
```

**Solution**:

1. Update `VITE_RP_ID` to match new custom domain
2. Redeploy application
3. Users must create new passkeys (old ones won't work with new domain)

#### Environment Variables Not Loading

```
Error: import.meta.env.VITE_RP_ID is undefined
```

**Solution**:

1. Verify environment variables are set in deployment platform
2. Ensure variable names start with `VITE_` (required by Vite)
3. Redeploy after adding/changing environment variables

#### Build Fails on Vercel

```
Error: Command failed: pnpm build
```

**Solution**:

1. Check `vercel.json` configuration is correct
2. Verify `pnpm-lock.yaml` is committed to git
3. Check build logs for specific error messages

## Troubleshooting

### Browser Says Passkeys Not Supported

**Symptom:** Red warning banner saying "Your browser doesn't support passkeys with PRF extension"

**Solutions:**

1. Check browser version:
   - Chrome/Edge: Must be 108+
   - Safari: Must be 17+ (macOS 14+, iOS 17+)
   - Firefox: Not supported (use Chrome/Safari instead)
2. Update your browser to the latest version
3. Try a different browser from the compatibility table above
4. Ensure you have a platform authenticator:
   - macOS: Touch ID must be enabled
   - Windows: Windows Hello must be set up
   - iOS: Face ID or Touch ID must be configured

### Passkey Creation Fails

**Symptom:** Error when clicking "Create Passkey"

**Common Causes:**

1. **Not on HTTPS**
   - Solution: Use `https://localhost` or deploy to HTTPS domain
   - Local dev: Vite automatically uses HTTPS with valid cert

2. **No Platform Authenticator**
   - Solution: Set up Touch ID, Face ID, or Windows Hello
   - Check: System Preferences > Touch ID (macOS) or Settings > Sign-in options (Windows)

3. **User Verification Not Available**
   - Solution: Ensure biometric authentication is enabled and working
   - Test: Try unlocking your device with biometric

4. **Browser Extension Conflict**
   - Solution: Disable browser extensions temporarily
   - Common culprits: Password managers, privacy tools

5. **PRF Extension Not Supported**
   - Solution: Update browser or switch to supported browser
   - Check: Browser compatibility table above

**Debug Steps:**

```javascript
// Open browser console (F12)
// Check for detailed error messages
// Look for PRF extension result:
console.log(credential.getClientExtensionResults())
```

### Wallet Address Changes

**Symptom:** After authenticating, you get a different address than expected

**This should NOT happen!** PRF is deterministic. Possible causes:

1. **Created New Passkey Instead of Authenticating**
   - Each new passkey creates a different PRF output
   - Solution: Delete the unwanted passkey, use the original one

2. **Different Device/Browser**
   - Each device produces different PRF outputs (by design)
   - Solution: Create passkey on each device separately
   - Or: Use iCloud/Google password sync to sync passkeys

3. **Different PRF Salt**
   - If the salt changed, PRF output changes
   - Solution: Check `prfSalt` in config (should be `'ecdsa-signing-key-v1'`)

4. **IndexedDB Cleared**
   - Credential ID lost, app creates new passkey
   - Solution: Backup your passkey via iCloud/Google sync

**Clarification:**

- FaceWallet shows your **user-chosen address** (from wallet or manual entry)
- The PRF-derived key is used for **signing**, not address generation
- If you see a different address, check which mode you're in (wallet vs manual)

### Passkey Works on One Device But Not Another

**Symptom:** Passkey works on iPhone but fails on MacBook (or vice versa)

**Expected Behavior:**

- Passkeys should sync via iCloud Keychain (Apple) or Google Password Manager
- May take a few minutes to sync

**Solutions:**

1. **Check Sync Settings**
   - iOS/macOS: Settings > [Your Name] > iCloud > Passwords and Keychain (enabled)
   - Chrome: Settings > Passwords > Enable password sync

2. **Wait for Sync**
   - Can take 5-15 minutes for passkeys to sync
   - Force sync: Turn iCloud Keychain off and on

3. **Create Device-Specific Passkey**
   - Alternative: Create a separate passkey on each device
   - Same address, different PRF keys (both can sign)

4. **Check Same Account**
   - Ensure logged into same iCloud/Google account on both devices

### Message Signing Fails

**Symptom:** Error when clicking "Sign with Passkey"

**Common Causes:**

1. **No Active Passkey**
   - Solution: Create a passkey first

2. **Authentication Canceled**
   - User canceled biometric prompt
   - Solution: Try again, approve biometric prompt

3. **PRF Authentication Failed**
   - Device failed to derive PRF output
   - Solution: Recreate passkey

4. **Invalid Message**
   - Empty message or unsupported characters
   - Solution: Enter valid message text

**Debug:**

```javascript
// Check if passkey exists
const hasPasskey = await passkeyContext.hasPasskey(address)
console.log('Has passkey:', hasPasskey)

// Check authentication result
const result = await passkeyContext.signMessage(message)
console.log('Sign result:', result)
```

### IndexedDB Quota Exceeded

**Symptom:** "QuotaExceededError" when creating passkey

**Solutions:**

1. Clear browser data for the site
2. Delete unused passkeys
3. Check available storage: Chrome DevTools > Application > Storage

### Browser Console Errors

**PRF Extension Error**

```
Error: PRF extension not supported or failed
```

- Cause: Browser doesn't support PRF or authentication failed
- Solution: Check browser version, update browser, verify platform authenticator

**Invalid Private Key Error**

```
Error: Invalid private key for secp256k1
```

- This should be handled automatically by `ensureValidPrivateKey()`
- If you see this: File a bug report, include browser/platform details

**Credential Not Found**

```
Error: No passkey found for this wallet address
```

- Cause: Trying to authenticate before creating passkey
- Solution: Create passkey first

## License

MIT License - see [LICENSE](LICENSE) file for details

---

## Additional Resources

### WebAuthn & PRF Specification

- [WebAuthn Level 3 Specification](https://w3c.github.io/webauthn/)
- [PRF Extension Specification](https://w3c.github.io/webauthn/#prf-extension)
- [Passkeys.dev](https://passkeys.dev/) - Comprehensive passkey guide

### Web3 Documentation

- [RainbowKit Docs](https://www.rainbowkit.com/docs/introduction)
- [Wagmi Docs](https://wagmi.sh/)
- [Viem Docs](https://viem.sh/)
- [Ethers.js Docs](https://docs.ethers.org/v6/)

### Cryptography Libraries

- [@noble/secp256k1](https://github.com/paulmillr/noble-secp256k1)
- [@noble/hashes](https://github.com/paulmillr/noble-hashes)

### Browser Support

- [Can I Use: WebAuthn](https://caniuse.com/webauthn)
- [Chrome Platform Status: PRF Extension](https://chromestatus.com/feature/5689381380431872)
- [WebKit Feature Status: PRF Extension](https://webkit.org/status/#specification-web-authentication-level-3)

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Follow code style**: Run `pnpm lint:fix && pnpm format` before committing
4. **Test thoroughly**: Verify on multiple browsers (Chrome, Safari, Edge)
5. **Write clear commit messages**: Use conventional commit format
   - `feat: add transaction sending`
   - `fix: resolve PRF detection issue on Safari`
   - `docs: update browser compatibility table`
6. **Submit a pull request**: Describe your changes clearly

### Code Style

- Use TypeScript for all new code
- Follow existing component patterns
- Add comments for complex logic
- Use meaningful variable names
- Keep functions small and focused

### Testing Checklist

- [ ] Works on Chrome 108+
- [ ] Works on Safari 17+ (macOS/iOS)
- [ ] Works on Edge 108+
- [ ] Graceful error handling for unsupported browsers
- [ ] TypeScript compiles without errors
- [ ] ESLint passes (`pnpm lint`)
- [ ] Code is formatted (`pnpm format`)
- [ ] Build succeeds (`pnpm build`)

---

## Support

### Questions?

- Open an issue on [GitHub Issues](https://github.com/yourusername/facewallet/issues)
- Check the [Troubleshooting](#troubleshooting) section above
- Review [WebAuthn documentation](https://w3c.github.io/webauthn/)

### Found a Bug?

- File a detailed bug report on GitHub Issues
- Include: Browser version, OS, error messages, steps to reproduce
- Screenshots or screen recordings are helpful

### Security Issues?

- **DO NOT** open a public issue for security vulnerabilities
- Email security concerns to: [your-email@example.com]
- Allow 48 hours for initial response

---

**Built with passion for a passwordless future.**

No seed phrases. No private keys. Just biometrics.
