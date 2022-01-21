import "mocha" // using @types/mocha
import { expect, } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { sortJson } from "../../src/common"

addCompletionHooks()

describe("JSON sorting", () => {
  it("Should reorder JSON objects alphabetically", () => {
    let strA = JSON.stringify(sortJson("abc"))
    let strB = JSON.stringify(sortJson("abc"))
    expect(strA).to.equal(strB)

    strA = JSON.stringify(sortJson(123))
    strB = JSON.stringify(sortJson(123))
    expect(strA).to.equal(strB)

    strA = JSON.stringify(sortJson({}))
    strB = JSON.stringify(sortJson({}))
    expect(strA).to.equal(strB)

    strA = JSON.stringify(sortJson({ a: 1, b: 2 }))
    strB = JSON.stringify(sortJson({ b: 2, a: 1 }))
    expect(strA).to.equal(strB)

    strA = JSON.stringify(sortJson({ a: 1, b: { c: 3, d: 4 } }))
    strB = JSON.stringify(sortJson({ b: { d: 4, c: 3 }, a: 1 }))
    expect(strA).to.equal(strB)

    strA = JSON.stringify(sortJson({ a: 1, b: [{ a: 10, m: 10, z: 10 }, { b: 11, n: 11, y: 11 }, 4, 5] }))
    strB = JSON.stringify(sortJson({ b: [{ z: 10, m: 10, a: 10 }, { y: 11, n: 11, b: 11 }, 4, 5], a: 1 }))
    expect(strA).to.equal(strB)

    strA = JSON.stringify(sortJson({ a: 1, b: [5, 4, 3, 2, 1, 0] }))
    strB = JSON.stringify(sortJson({ b: [5, 4, 3, 2, 1, 0], a: 1 }))
    expect(strA).to.equal(strB)
  })
})
