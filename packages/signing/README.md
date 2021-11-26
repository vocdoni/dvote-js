# @vocdoni/signing

@vocdoni/signing contains signing helpers for the [dvote-js library](https://github.com/vocdoni/dvote-js/)

## Installation

Use [npm](https://www.npmjs.com/) to install @vocdoni/signing.

```bash
npm install @vocdoni/signing
```

## Usage

#### BytesSignature

```ts
import { BytesSignature } from "@vocdoni/signing"
import { computePublicKey } from "@ethersproject/signing-key"
import { Wallet } from "@ethersproject/wallet"

const wallet = new Wallet("8d7d56a9efa4158d232edbeaae601021eb3477ad77b5f3c720601fd74e8e04bb")

const jsonBody = '{ "method": "getVisibility", "timestamp": 1582196988554 }'
const bytesBody = new TextEncoder().encode(jsonBody)

const signature = await BytesSignature.sign(bytesBody, wallet)
// returns '0xf59447c1f981a0760c6b74acaef2b54efaeb5f5653cb314349586454ded27d305542b90011eaa3c03e1c66ba3149fe9e17a4c3bcffd4e339e8e1dc5af34a5a941b'

BytesSignature.isValid(signature, computePublicKey(wallet.publicKey, true), bytesBody)
// returns 'true'
BytesSignature.isValid(signature, wallet.publicKey, bytesBody)
// returns 'true'
```

#### JsonSignature

```ts
import { JsonSignature } from "@vocdoni/signing"
import { computePublicKey } from "@ethersproject/signing-key"
import { Wallet } from "@ethersproject/wallet"

const wallet = new Wallet("8d7d56a9efa4158d232edbeaae601021eb3477ad77b5f3c720601fd74e8e04bb")
const jsonBody = { a: 1, b: "hi", c: false, d: [1, 2, 3, 4, 5, 6] }

const signature = await JsonSignature.sign(jsonBody, wallet)
// returns '0xa1fbf799c48f64535a5a20c741f02c25be04127642b6901c4231d9f55d5b6e860fbb0b16d5a9ec6fa029d8b86993d653e0e8573b32a3a19f37945467e7024a231c'

const recoveredPubKeyComp = JsonSignature.recoverPublicKey(jsonBody, signature)
// returns '0x02cb3cabb521d84fc998b5649d6b59e27a3e27633d31cc0ca6083a00d68833d5ca'
const recoveredPubKey = JsonSignature.recoverPublicKey(jsonBody, signature, true)
// returns '0x04cb3cabb521d84fc998b5649d6b59e27a3e27633d31cc0ca6083a00d68833d5caeaeb67fbce49e44f089a28f46a4d815abd51bc5fc122065518ea4adb199ba780'

const strA = JSON.stringify(JsonSignature.sort({ a: 1, b: [{ a: 10, m: 10, z: 10 }, { b: 11, n: 11, y: 11 }, 4, 5] }))
const strB = JSON.stringify(JsonSignature.sort({ b: [{ z: 10, m: 10, a: 10 }, { y: 11, n: 11, b: 11 }, 4, 5], a: 1 }))
// strA === strB

JsonSignature.isValid(signature, computePublicKey(wallet.publicKey, true), jsonBody)
// returns 'true'
JsonSignature.isValid(signature, wallet.publicKey, jsonBody)
// returns 'true'
```

## Testing

To execute library tests just run

```bash
npm run test
```
