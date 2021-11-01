# @vocdoni/common

@vocdoni/common is the common package of the [dvote-js library](https://github.com/vocdoni/dvote-js/)

## Installation

Use [npm](https://www.npmjs.com/) to install @vocdoni/common.

```bash
npm install @vocdoni/common
```

## Usage

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

## Testing

To execute library tests just run

```bash
npm run test
```
