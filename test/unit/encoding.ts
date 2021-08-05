import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Buffer } from "buffer/"

import { AccountBackup } from "../../src/models/backup"
import { Wallet_AuthMethod } from "../../src"
import { bigIntToBuffer, bufferToBigInt, hexStringToBuffer } from "../../src/util/encoding"

addCompletionHooks()

describe("Value encoding", () => {
  it("It should convert hex strings to a buffer", () => {
    const inputs = [
      { hex: "0x00", serializedBuffer: "0" },
      { hex: "0x10", serializedBuffer: "16" },
      { hex: "0xff", serializedBuffer: "255" },
      { hex: "0xffffffff", serializedBuffer: "255,255,255,255" },
      { hex: "0xaaaaaaaaaaaaaaaa", serializedBuffer: "170,170,170,170,170,170,170,170" },
    ]

    for (let input of inputs) {
      const result = hexStringToBuffer(input.hex)
      expect(result.join(",")).to.eq(input.serializedBuffer)
    }
  })

  it("It should convert big integers into a buffer", () => {
    const inputs = [
      { bigint: BigInt("0"), hexBuffer: "00" },
      { bigint: BigInt("1"), hexBuffer: "01" },
      { bigint: BigInt("10"), hexBuffer: "0a" },
      { bigint: BigInt("16"), hexBuffer: "10" },
      { bigint: BigInt("100"), hexBuffer: "64" },
      { bigint: BigInt("10000"), hexBuffer: "2710" },
      { bigint: BigInt("20000"), hexBuffer: "4e20" },
      { bigint: BigInt("5000000000000"), hexBuffer: "048c27395000" },
      { bigint: BigInt("999999999999999999999999999999999"), hexBuffer: "314dc6448d9338c15b09ffffffff" },
      {
        bigint: BigInt("11112222333344445555666677778888999900001111222233334444555566667777888899990000"),
        hexBuffer: "5ff78ef4da793532a1837391cd5ff1ce74947cadc89a86168c783b908b98b681f0"
      },
    ]

    for (let input of inputs) {
      const result = bigIntToBuffer(input.bigint)
      expect(result.toString("hex")).to.eq(input.hexBuffer)
    }
  })

  it("It should convert buffers into big integers", () => {
    const inputs = [
      { bigint: BigInt("0"), hexBuffer: "00" },
      { bigint: BigInt("1"), hexBuffer: "01" },
      { bigint: BigInt("10"), hexBuffer: "0a" },
      { bigint: BigInt("16"), hexBuffer: "10" },
      { bigint: BigInt("100"), hexBuffer: "64" },
      { bigint: BigInt("10000"), hexBuffer: "2710" },
      { bigint: BigInt("20000"), hexBuffer: "4e20" },
      { bigint: BigInt("5000000000000"), hexBuffer: "048c27395000" },
      { bigint: BigInt("999999999999999999999999999999999"), hexBuffer: "314dc6448d9338c15b09ffffffff" },
      {
        bigint: BigInt("11112222333344445555666677778888999900001111222233334444555566667777888899990000"),
        hexBuffer: "5ff78ef4da793532a1837391cd5ff1ce74947cadc89a86168c783b908b98b681f0"
      },
    ]

    for (let input of inputs) {
      const result = bufferToBigInt(Buffer.from(input.hexBuffer, "hex"))
      expect(result).to.eq(input.bigint)
    }
  })
})
