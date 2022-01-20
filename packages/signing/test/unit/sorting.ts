import "mocha" // using @types/mocha
import { expect, } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { JsonSignature, BytesSignature } from "../../src"

addCompletionHooks()

describe("JSON sorting", () => {
  it("Should reorder JSON objects alphabetically", () => {
    let strA = JSON.stringify(JsonSignature.sort("abc"))
    let strB = JSON.stringify(JsonSignature.sort("abc"))
    expect(strA).to.equal(strB)

    strA = JSON.stringify(JsonSignature.sort(123))
    strB = JSON.stringify(JsonSignature.sort(123))
    expect(strA).to.equal(strB)

    strA = JSON.stringify(JsonSignature.sort({}))
    strB = JSON.stringify(JsonSignature.sort({}))
    expect(strA).to.equal(strB)

    strA = JSON.stringify(JsonSignature.sort({ a: 1, b: 2 }))
    strB = JSON.stringify(JsonSignature.sort({ b: 2, a: 1 }))
    expect(strA).to.equal(strB)

    strA = JSON.stringify(JsonSignature.sort({ a: 1, b: { c: 3, d: 4 } }))
    strB = JSON.stringify(JsonSignature.sort({ b: { d: 4, c: 3 }, a: 1 }))
    expect(strA).to.equal(strB)

    strA = JSON.stringify(JsonSignature.sort({ a: 1, b: [{ a: 10, m: 10, z: 10 }, { b: 11, n: 11, y: 11 }, 4, 5] }))
    strB = JSON.stringify(JsonSignature.sort({ b: [{ z: 10, m: 10, a: 10 }, { y: 11, n: 11, b: 11 }, 4, 5], a: 1 }))
    expect(strA).to.equal(strB)

    strA = JSON.stringify(JsonSignature.sort({ a: 1, b: [5, 4, 3, 2, 1, 0] }))
    strB = JSON.stringify(JsonSignature.sort({ b: [5, 4, 3, 2, 1, 0], a: 1 }))
    expect(strA).to.equal(strB)
  })
})
