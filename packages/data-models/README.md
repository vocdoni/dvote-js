# @vocdoni/data-models

@vocdoni/data-models contains the data model definitions for the [dvote-js library](https://github.com/vocdoni/dvote-js/)

## Installation

Use [npm](https://www.npmjs.com/) to install @vocdoni/data-models.

```bash
npm install @vocdoni/data-models
```

## Usage

#### Account Backup

```ts
import { AccountBackup } from "@vocdoni/data-models"

const wallet = Wallet.createRandom()
const originalPassphrase = Math.random().toString()
const encryptedMnemonic = AccountBackup.encryptPayload(wallet.mnemonic.phrase, originalPassphrase)

const backupBytes = AccountBackup.create({
  backupName: "Hello world",
  questionIds: [1, 2, 3],
  answers: ["Answer 1", "Answer 2", "Answer 3"],
  accountWallet: {
    encryptedMnemonic,
    authMethod: Wallet_AuthMethod.PASS,
    hdPath: wallet.mnemonic.path,
    locale: wallet.mnemonic.locale
  },
  currentPassphrase: originalPassphrase
})
const decryptedPassphrase = AccountBackup.recoverPassphrase(backupBytes, ["Answer 1", "Answer 2", "Answer 3"])

```

#### Entity Metadata

```ts
import { checkValidEntityMetadata } from "@vocdoni/data-models"

checkValidEntityMetadata({})
// throws an Error
```

#### Process Metadata

```ts
import { checkValidProcessMetadata } from "@vocdoni/data-models"

checkValidProcessMetadata({})
// throws an Error
```

#### Raw transactions

```ts
import { Tx, wrapRawTransaction } from "@vocdoni/data-models"
import { BytesSignatureVocdoni } from "@vocdoni/signing"

const tx = Tx.encode(...)
const txBytes = tx.finish()
const signature = await BytesSignatureVocdoni.sign(txBytes, chainId, signer)

const result = wrapRawTransaction(txBytes, signature)
// { method: "submitRawTx", payload: "base64..."}
```

## Testing

To execute library tests just run

```bash
npm run test
```
