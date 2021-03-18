import "mocha" // using @types/mocha
import { expect, } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { serializeBackupLink, deserializeBackupLink } from "../../src/models/backup"
import { BackupLink } from "../../src/models/protobuf"

addCompletionHooks()

describe("Protobuf models", () => {
    it("Should serialize and deserialize Backup Links", () => {
        const items: BackupLink[] = [
            { auth: "12345678", key: "23456789", questions: ["a", "b", "c"], version: "1.0" },
            { auth: "012345678", key: "234567890", questions: ["aa", "bb", "cc"], version: "1.0.0" },
            { auth: "0012345678", key: "2345678900", questions: ["aaa", "bbb", "ccc"], version: "1.0.1" },
            { auth: "00012345678", key: "23456789000", questions: ["aaaa", "bbbb", "cccc"], version: "1.0.2" },
            { auth: "000012345678", key: "234567890000", questions: ["aaaaa", "bbbbb", "ccccc"], version: "1.0.3" },
        ]

        items.forEach(item => {
            const serialized = serializeBackupLink(item)
            expect(serialized instanceof Uint8Array).to.be.true
            const deserialized = deserializeBackupLink(serialized)

            expect(deserialized.auth).to.eq(item.auth)
            expect(deserialized.key).to.eq(item.key)
            expect(deserialized.questions).to.deep.eq(item.questions)
            expect(deserialized.version).to.eq(item.version)
        })
    })
})
