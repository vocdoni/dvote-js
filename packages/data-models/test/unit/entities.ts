import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { checkValidEntityMetadata, EntityMetadataTemplate } from "../../src"

addCompletionHooks()

describe("Entity metadata", () => {

    it("Should accept a valid Entity Metadata JSON", () => {
        const entityMetadata = EntityMetadataTemplate

        expect(() => {
            checkValidEntityMetadata(entityMetadata)
        }).to.not.throw()
    })

    it("Should reject invalid Entity Metadata JSON payloads", () => {
        const invalidMeta = 123
        // Totally invalid
        expect(() => {
            const payload = JSON.parse('{"test": 123}')
            checkValidEntityMetadata(payload)
        }).to.throw()

        expect(() => {
            const payload = JSON.parse('{"name": {"default": "hello", "fr": "Alô"}}')
            checkValidEntityMetadata(payload)
        }).to.throw()

        // Incomplete fields
        const entityMetadata = JSON.parse(JSON.stringify(EntityMetadataTemplate))

        expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { version: null })) }).to.throw()
        expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { languages: null })) }).to.throw()
        expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { name: null })) }).to.throw()
        expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { description: null })) }).to.throw()
        expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { votingProcesses: [] })) }).to.not.throw()
        expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { newsFeed: null })) }).to.throw()
        expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { media: { avatar: null } })) }).to.throw()
        expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { actions: null })) }).to.throw()
        expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { bootEntities: [] })) }).to.not.throw()
        expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { fallbackBootNodeEntities: [] })) }).to.not.throw()
        expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { trustedEntities: [] })) }).to.not.throw()
        expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { censusServiceManagedEntities: [] })) }).to.not.throw()
    })
})
