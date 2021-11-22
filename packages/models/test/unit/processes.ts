import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import ProcessMetadataBuilder from "../builders/process-metadata"
import { checkValidProcessMetadata } from "../../src"

addCompletionHooks()

describe("Metadata validation", () => {
    it("Should accept a valid Process Metadata JSON", () => {
        const processMetadata = new ProcessMetadataBuilder().build()
        expect(() => {
            checkValidProcessMetadata(processMetadata)
        }).to.not.throw()
    })

    it("Should reject a non valid Process Metadata JSON", () => {
        expect(() => {
            checkValidProcessMetadata(null)
        }).to.throw()
    })

    it("Should reject invalid Process Metadata JSON payloads", () => {
        const processMetadata = new ProcessMetadataBuilder().build()
        // Totally invalid
        expect(() => {
            const payload = JSON.parse('{"test": 123}')
            checkValidProcessMetadata(payload)
        }).to.throw()

        expect(() => {
            const payload = JSON.parse('{"name": {"default": "hello", "fr": "Alô"}}')
            checkValidProcessMetadata(payload)
        }).to.throw()

        expect(() => {
            processMetadata.questions[0].choices[0].value = "a" as any
            checkValidProcessMetadata(processMetadata)
        }).to.throw()
    })

    it("Should reject null required fields", () => {
        const processMetadata = new ProcessMetadataBuilder().build()
        // Incomplete fields
        expect(() => {
            checkValidProcessMetadata(Object.assign({}, processMetadata, { version: null }))
        }).to.throw()
        expect(() => {
            checkValidProcessMetadata(Object.assign({}, processMetadata, { title: null }))
        }).to.throw()
        expect(() => {
            checkValidProcessMetadata(Object.assign({}, processMetadata, { description: null }))
        }).to.throw()
        expect(() => {
            checkValidProcessMetadata(Object.assign({}, processMetadata, { media: null }))
        }).to.throw()
        expect(() => {
            checkValidProcessMetadata(Object.assign({}, processMetadata, { questions: null }))
        }).to.throw()
    })

    it("Should accept big number of questions", () => {
        const processMetadata = new ProcessMetadataBuilder().withNumberOfQuestions(200).build()
        expect(() => {
            checkValidProcessMetadata(processMetadata)
        }).to.not.throw()

        const result = checkValidProcessMetadata(processMetadata)
        expect(result.questions.length).to.equal(200)
    }).timeout(10000)

    it("Should accept big number of choices", () => {
        const processMetadata = new ProcessMetadataBuilder().withNumberOfChoices(200)
        expect(() => {
            checkValidProcessMetadata(processMetadata)
        }).to.not.throw()

        const result = checkValidProcessMetadata(processMetadata)
        expect(result.questions[0].choices.length).to.equal(200)
    }).timeout(4000)

    it("Should allow for arbitrary fields within `meta`", () => {
        const processMetadata = new ProcessMetadataBuilder().build()
        processMetadata.meta = undefined
        expect(() => {
            checkValidProcessMetadata(processMetadata)
        }).to.not.throw()

        processMetadata.meta = {}
        expect(() => {
            checkValidProcessMetadata(processMetadata)
        }).to.not.throw()

        processMetadata.meta = { a: "1234", b: 2345 }
        expect(() => {
            checkValidProcessMetadata(processMetadata)
        }).to.not.throw()

        processMetadata.meta = { a: ["a", 3, null, false] }
        expect(() => {
            checkValidProcessMetadata(processMetadata)
        }).to.not.throw()
    })
})
