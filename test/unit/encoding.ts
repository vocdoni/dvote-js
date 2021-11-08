import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Buffer } from "buffer/"

import { AccountBackup } from "../../src/models/backup"
import { Wallet_AuthMethod } from "../../src"
import { bigIntToBuffer, bigIntToLeBuffer, bufferLeToBigInt, bufferToBigInt, hexStringToBuffer, uintArrayToHex } from "../../src/util/encoding"

addCompletionHooks()

describe("Value encoding", () => {
  it("Should convert hex strings to a buffer", () => {
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

  it("Should convert Uint8Array's into hex strings", () => {
    const items = [
      { buffer: new Uint8Array([]), with0x: false, output: "" },
      { buffer: new Uint8Array([]), with0x: true, output: "0x" },
      { buffer: new Uint8Array([0]), with0x: false, output: "00" },
      { buffer: new Uint8Array([0]), with0x: true, output: "0x00" },
      { buffer: new Uint8Array([1]), with0x: false, output: "01" },
      { buffer: new Uint8Array([1]), with0x: true, output: "0x01" },
      { buffer: new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 250, 255]), with0x: false, output: "0a141e28323c46505a64c8faff" },
      { buffer: new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 250, 255]), with0x: true, output: "0x0a141e28323c46505a64c8faff" },
      { buffer: new Uint8Array([100, 100, 100, 100, 100, 100]), with0x: false, output: "646464646464" },
      { buffer: new Uint8Array([100, 100, 100, 100, 100, 100]), with0x: true, output: "0x646464646464" },
      { buffer: new Uint8Array([0, 255]), with0x: false, output: "00ff" },
      { buffer: new Uint8Array([0, 255]), with0x: true, output: "0x00ff" },
    ]

    for (let item of items) {
      const hex = uintArrayToHex(item.buffer, item.with0x)
      expect(hex).to.eq(item.output)
    }
  })

  it("Should convert big integers into a buffer", () => {
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

      const leResult = bigIntToLeBuffer(input.bigint)
      expect(leResult.reverse().toString("hex")).to.eq(input.hexBuffer)
    }
  })

  it("Should convert buffers into big integers", () => {
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

      const result2 = bufferLeToBigInt(Buffer.from(input.hexBuffer, "hex").reverse())
      expect(result2).to.eq(input.bigint)
    }
  })
})
