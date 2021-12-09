import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Buffer } from "buffer/"

import { bigIntToBuffer, bigIntToLeBuffer, bufferLeToBigInt, bufferToBigInt, ensure0x, hexStringToBuffer, strip0x, uintArrayToHex } from "../../src"

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
      { bigint: BigInt("0"), hexBuffer: "0000000000000000000000000000000000000000000000000000000000000000" },
      { bigint: BigInt("1"), hexBuffer: "0000000000000000000000000000000000000000000000000000000000000001" },
      { bigint: BigInt("10"), hexBuffer: "000000000000000000000000000000000000000000000000000000000000000a" },
      { bigint: BigInt("16"), hexBuffer: "0000000000000000000000000000000000000000000000000000000000000010" },
      { bigint: BigInt("100"), hexBuffer: "0000000000000000000000000000000000000000000000000000000000000064" },
      { bigint: BigInt("10000"), hexBuffer: "0000000000000000000000000000000000000000000000000000000000002710" },
      { bigint: BigInt("20000"), hexBuffer: "0000000000000000000000000000000000000000000000000000000000004e20" },
      { bigint: BigInt("5000000000000"), hexBuffer: "0000000000000000000000000000000000000000000000000000048c27395000" },
      { bigint: BigInt("999999999999999999999999999999999"), hexBuffer: "000000000000000000000000000000000000314dc6448d9338c15b09ffffffff" },
      {
        bigint: BigInt("111122223333444455556666777788889999000011112222333344445555666677778888999900"),
        hexBuffer: "f5acf316aa2c0d4e6a464693f94789be9b15ba0ece586181679a3215e03f43dc"
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
      { bigint: BigInt("0"), hexBuffer: "0000000000000000000000000000000000000000000000000000000000000000" },
      { bigint: BigInt("1"), hexBuffer: "0000000000000000000000000000000000000000000000000000000000000001" },
      { bigint: BigInt("10"), hexBuffer: "000000000000000000000000000000000000000000000000000000000000000a" },
      { bigint: BigInt("16"), hexBuffer: "0000000000000000000000000000000000000000000000000000000000000010" },
      { bigint: BigInt("100"), hexBuffer: "0000000000000000000000000000000000000000000000000000000000000064" },
      { bigint: BigInt("10000"), hexBuffer: "0000000000000000000000000000000000000000000000000000000000002710" },
      { bigint: BigInt("20000"), hexBuffer: "0000000000000000000000000000000000000000000000000000000000004e20" },
      { bigint: BigInt("5000000000000"), hexBuffer: "0000000000000000000000000000000000000000000000000000048c27395000" },
      { bigint: BigInt("999999999999999999999999999999999"), hexBuffer: "000000000000000000000000000000000000314dc6448d9338c15b09ffffffff" },
      {
        bigint: BigInt("111122223333444455556666777788889999000011112222333344445555666677778888999900"),
        hexBuffer: "f5acf316aa2c0d4e6a464693f94789be9b15ba0ece586181679a3215e03f43dc"
      },
    ]

    for (let input of inputs) {
      const result = bufferToBigInt(Buffer.from(input.hexBuffer, "hex"))
      expect(result).to.eq(input.bigint)

      const result2 = bufferLeToBigInt(Buffer.from(input.hexBuffer, "hex").reverse())
      expect(result2).to.eq(input.bigint)
    }
  })

  it("Should strip 0x prefixes", () => {
    const inputs = [
      // strip
      { in: "0x0", out: "0" },
      { in: "0x00", out: "00" },
      { in: "0x1234", out: "1234" },
      { in: "0x55555555555555555555", out: "55555555555555555555" },
      // skip
      { in: "1234", out: "1234" },
      { in: "abcd", out: "abcd" },
      { in: "1234567890abcdef", out: "1234567890abcdef" },
    ]

    for (let input of inputs) {
      const result = strip0x(input.in)
      expect(result).to.eq(input.out)
    }
  })

  it("Should ensure 0x prefixes", () => {
    const inputs = [
      // strip
      { in: "0", out: "0x0" },
      { in: "00", out: "0x00" },
      { in: "1234", out: "0x1234" },
      { in: "55555555555555555555", out: "0x55555555555555555555" },
      // skip
      { in: "0x1234", out: "0x1234" },
      { in: "0xabcd", out: "0xabcd" },
      { in: "0x1234567890abcdef", out: "0x1234567890abcdef" },
    ]

    for (let input of inputs) {
      const result = ensure0x(input.in)
      expect(result).to.eq(input.out)
    }
  })
})
