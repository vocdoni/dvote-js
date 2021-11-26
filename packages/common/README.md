# @vocdoni/common

@vocdoni/common contains shared helpers, models and type definitions for the [dvote-js library](https://github.com/vocdoni/dvote-js/)

## Installation

Use [npm](https://www.npmjs.com/) to install @vocdoni/common.

```bash
npm install @vocdoni/common
```

## Usage

#### Encoding

```ts
import { hexStringToBuffer, uintArrayToHex, bigIntToBuffer, bufferToBigInt } from "@vocdoni/common"

hexStringToBuffer("AABBCC12")
// returns '<Buffer aa bb cc 12>'

const buffer = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 250, 255])
uintArrayToHex(buffer)
// returns '0a141e28323c46505a64c8faff'
uintArrayToHex(buffer, true)
// returns '0x0a141e28323c46505a64c8faff'

const bigint = BigInt("123")
bigIntToBuffer(bigint)
// returns '<Buffer 7b>'

bufferToBigInt(Buffer.from("64", "hex"))
// returns '100n'
```

#### Random

```ts
import { Random } from "@vocdoni/common"

const bytes = Random.getBytes(8)
// returns '<Buffer 4b 77 f5 f6 30 fc 1a d2>' (random)

const hex = Random.getHex()
// returns '0x64fa37b4d6139678787efebb8bbddcb104de323ccb980343dbfaceca0a49ac83' (32 byte hash (starting with "0x"))

const bigint = Random.getBigInt(256n)
// returns '28n' (random)

const shuffle = Random.shuffle([1, 2, 3, 4])
// returns '[ 2, 4, 1, 3 ]' (random order)
```

## Testing

To execute library tests just run

```bash
npm run test
```
