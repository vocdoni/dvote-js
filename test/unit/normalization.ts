import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { normalizeText } from "../../src/util/normalization"

addCompletionHooks()

describe("Text normalization", () => {
    it("Normalized texts should match latin characters", () => {
        const items = [
            { original: "àèìòùáéíóúâêîôûäëïöü", normalized: "aeiouaeiouaeiouaeiou" },
            { original: "ÀÈÌÒÙÁÉÍÓÚÂÊÎÔÛÄËÏÖÜ", normalized: "aeiouaeiouaeiouaeiou" },
            { original: "çÇñÑ", normalized: "ccnn" },
            { original: "", normalized: "" },
        ]

        for (let item of items) {
            expect(normalizeText(item.original)).to.eq(item.normalized)
        }
    })
    it("Normalized texts should be lowercase", () => {
        const items = [
            { original: "ZXCVBNMASDFGHJKLQWERTYUIOP", normalized: "zxcvbnmasdfghjklqwertyuiop" },
            { original: "aAbBcC", normalized: "aabbcc" },
        ]

        for (let item of items) {
            expect(normalizeText(item.original)).to.eq(item.normalized)
        }
    })
    it("Normalized texts should have no extra blank spaces", () => {
        const items = [
            { original: "     a       b       c        ", normalized: "a b c" },
            { original: " \t\t\t\t\n a \t\t\t\t\n b \t\t\t\t\n c \t\t\t\t\n ", normalized: "a b c" },
        ]

        for (let item of items) {
            expect(normalizeText(item.original)).to.eq(item.normalized)
        }
    })
    it("Normalized texts should skip symbol collisions", () => {
        const items = [
            { original: "d'Angelo d`Angelo d´Angelo", normalized: "d'angelo d'angelo d'angelo" },
            { original: "a.a·a:a", normalized: "a.a.a.a" },
        ]

        for (let item of items) {
            expect(normalizeText(item.original)).to.eq(item.normalized)
        }
    })
})
