# @vocdoni/hashing

@vocdoni/hashing contains hashing helpers for the [dvote-js library](https://github.com/vocdoni/dvote-js/)

## Installation

Use [npm](https://www.npmjs.com/) to install @vocdoni/hashing.

```bash
npm install @vocdoni/hashing
```

## Usage

#### Keccak256

```ts
import { Keccak256 } from "@vocdoni/hashing"

const text = "This is an example"
Keccak256.hashText(text)
// returns '0x041a34ca22b57f8355a7995e261fded7a10f6b2c634fb9f6bfdbdafcbf556840'

const hex = "0xAAAA"
Keccak256.hashHexString(hex)
// returns '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'

const bytes = new Uint8Array([1, 2, 3, 4, 5])
Keccak256.hashBytes(bytes)
// returns '0x7d87c5ea75f7378bb701e404c50639161af3eff66293e9f375b5f17eb50476f4'
```

#### Poseidon

```ts
import { Poseidon } from "@vocdoni/hashing"

const BI_1 = BigInt("1")
const BI_2 = BigInt("2")

Poseidon.hash([BI_1, BI_2])
// returns '7853200120776062878684798364095072458815029376092732009249414926327459813530'
```

## Testing

To execute library tests just run

```bash
npm run test
```
