import "mocha" // using @types/mocha
import { expect, } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { digestVocdoniSignedPayload } from "../../src/common"

addCompletionHooks()

describe("Vocdoni digested signable payloads", () => {
  it("Should prefix strings and hash the payload", () => {
    const inputs = [
      { payload: "hello", chainId: 1, output: "Vocdoni signed message:\n1\n0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8" },
      { payload: "", chainId: 1, output: "Vocdoni signed message:\n1\n0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470" },
      { payload: "More text here", chainId: 1, output: "Vocdoni signed message:\n1\n0x85f4a8fca6cc7ed5ec4b9ec616aa7c2eecaf3460ecec19ff8c767fbf5f339c05" },
      { payload: "hello", chainId: 5, output: "Vocdoni signed message:\n5\n0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8" },
      { payload: "hello", chainId: 500, output: "Vocdoni signed message:\n500\n0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8" },
      { payload: "Emojjis ✅🟧", chainId: 1, output: "Vocdoni signed message:\n1\n0x80be4f44dec81e87f026a7e485fcceda9e3f8614e0971d1231b669cb71ddfd0d" },
    ]

    for (const item of inputs) {
      expect(digestVocdoniSignedPayload(item.payload, item.chainId)).to.equal(item.output)
    }
  })

  it("Should prefix buffers and hash the payload", () => {
    const inputs = [
      { payload: Buffer.from("hello"), chainId: 1, output: "566f63646f6e69207369676e6564206d6573736167653a0a310a307831633861666639353036383563326564346263333137346633343732323837623536643935313762396339343831323733313961303961376133366465616338" },
      { payload: new Uint8Array(), chainId: 1, output: "566f63646f6e69207369676e6564206d6573736167653a0a310a307863356432343630313836663732333363393237653764623264636337303363306535303062363533636138323237336237626661643830343564383561343730" },
      { payload: Buffer.from("More text here"), chainId: 1, output: "566f63646f6e69207369676e6564206d6573736167653a0a310a307838356634613866636136636337656435656334623965633631366161376332656563616633343630656365633139666638633736376662663566333339633035" },
      { payload: Buffer.from("hello"), chainId: 5, output: "566f63646f6e69207369676e6564206d6573736167653a0a350a307831633861666639353036383563326564346263333137346633343732323837623536643935313762396339343831323733313961303961376133366465616338" },
      { payload: Buffer.from("hello"), chainId: 500, output: "566f63646f6e69207369676e6564206d6573736167653a0a3530300a307831633861666639353036383563326564346263333137346633343732323837623536643935313762396339343831323733313961303961376133366465616338" },
      { payload: Buffer.from("Emojjis ✅🟧"), chainId: 1, output: "566f63646f6e69207369676e6564206d6573736167653a0a310a307838306265346634346465633831653837663032366137653438356663636564613965336638363134653039373164313233316236363963623731646466643064" },
    ]

    for (const item of inputs) {
      const result = digestVocdoniSignedPayload(item.payload, item.chainId)
      const hexResult = Buffer.from(result).toString("hex")
      expect(hexResult).to.equal(item.output)
    }
  })
})
