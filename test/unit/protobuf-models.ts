import "mocha" // using @types/mocha
import { expect, } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { AccountBackup } from "../../src/models/backup"
import { AccountBackupModel } from "../../src/models/protobuf"

addCompletionHooks()

describe("Protobuf models", () => {
    it("Should serialize and deserialize Backup Links", () => {
        const key = Buffer.from("0x23231213123123", "ascii")
        const items: AccountBackupModel[] = [
            { auth: 1, key, questions: [0, 1, 2], alias: "test" },
            { auth: 2, key, questions: [2, 3, 4], alias: "tests" },
        ]

        items.forEach(item => {
            const serialized = AccountBackup.serialize(item)
            expect(serialized instanceof Uint8Array).to.be.true
            const deserialized = AccountBackup.deserialize(serialized)

            expect(deserialized.auth).to.eq(item.auth)
            expect(Buffer.from(deserialized.key).toString("hex")).to.eq(Buffer.from(item.key).toString("hex"))
            expect(deserialized.questions).to.deep.eq(item.questions)
            expect(deserialized.alias).to.deep.eq(item.alias)
        })
    })

    it("Creates and decrypts backups from questions, answers and password", () => {
        const secret = "0x23231213123123"
        const key = Buffer.from(secret, "ascii")

        const password = "a strong password"
        const answers = ["test1", "test 3"]

        // Create a backup
        const contents = AccountBackup.create("testing", password, key, [1, 3], answers)

        // Deserialize its contents
        const result = AccountBackup.deserialize(contents)
        // Decrypt the key
        const decoded = AccountBackup.decryptKey(result.key, password, answers)

        expect(Buffer.from(decoded).toString("ascii")).to.be.eq(secret)
    })
})
