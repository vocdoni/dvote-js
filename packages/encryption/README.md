# @vocdoni/encryption

@vocdoni/encryption contains encryption helpers for the [dvote-js library](https://github.com/vocdoni/dvote-js/)

## Installation

Use [npm](https://www.npmjs.com/) to install @vocdoni/encryption.

```bash
npm install @vocdoni/encryption
```

## Usage

#### Asymmetric

```ts
import { Asymmetric } from "@vocdoni/encryption"

// See also: Asymmetric.encryptBytes, Asymmetric.encryptRaw
const encrypted = Asymmetric.encryptString("super secret", publicKey)
const decrypted = Asymmetric.decryptString(encrypted, privateKey)

console.log(decrypted)
// Prints "super secret
```

#### Symmetric

```ts
import { Asymmetric } from "@vocdoni/encryption"

// See also: Symmetric.encryptBytes, Symmetric.encryptRaw
const encrypted = Symmetric.encryptString("super secret", "my-passphrase")
const decrypted = Symmetric.decryptString(encrypted, "my-passphrase")

console.log(decrypted)
// Prints "super secret
```

## Testing

To execute library tests just run

```bash
npm run test
```
