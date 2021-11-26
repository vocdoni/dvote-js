# @vocdoni/wallets

@vocdoni/wallets contains wallets helpers for the [dvote-js library](https://github.com/vocdoni/dvote-js/)

## Installation

Use [npm](https://www.npmjs.com/) to install @vocdoni/wallets.

```bash
npm install @vocdoni/wallets
```

## Usage

### Metamask

```ts
import { SignerUtil } from "@vocdoni/wallets"

const signer = SignerUtil.fromInjectedWeb3()
// wallet.signMessage(...)

// See ethers.js > Signer
```

### Ethereum

```ts
import { WalletUtil } from "@vocdoni/wallets"

const wallet = WalletUtil.fromSeededPassphrase("my-passphrase", hexSeed)
// wallet.signMessage(...)

// See ethers.js > Wallet
```

### Baby JubJub

```ts
import { WalletBabyJub } from "@vocdoni/wallets"
import { Random } from "@vocdoni/common"

const wallet1 = WalletBabyJub.fromProcessCredentials(loginKey, processId, chosenSecret)

const seed = Random.getHex()
const wallet2 = WalletBabyJub.fromHexSeed(seed)

const privK = "123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0"
const wallet3 = new WalletBabyJub(privK)

// sign
const msg = Buffer.from("my message", "utf8")
const sign = wallet1.sign(msg)

// verify
const valid = WalletBabyJub.verify(msg, sig, wallet1.publicKey)
// => true
```

## Testing

To execute library tests just run

```bash
npm run test
```
