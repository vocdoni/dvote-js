import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { deserializeWalletBackup, serializeWalletBackup } from "../../src/models/backup"
import { Wallet, WalletBackup } from "../../src/models/protobuf"

addCompletionHooks()

describe("Protobuf models", () => {
    it("Should serialize and deserialize Wallet backups", () => {
        const wallets: Wallet[] = [
            { encryptedMnemonic: Buffer.from("random mnemonic"), hdPath: "m/44'/60'/0'/0/1", locale: "en", authMethod: 0 },
        ]
        const backups: WalletBackup[] = [
            {
                name: "name1", timestamp: Date.now(), wallet: wallets[0],
                passphraseRecovery: { questionIds: [0, 1], encryptedPassphrase: Buffer.from("passphrase") }
            },
        ]

        wallets.forEach(wallet => {
            const serialized = Wallet.encode(wallet).finish()
            expect(serialized instanceof Uint8Array).to.be.true
            const deserialized = Wallet.decode(serialized)
            expect(deserialized).to.eql(wallet)
        })

        backups.forEach(backup => {
            const serialized = serializeWalletBackup(backup)
            expect(serialized instanceof Uint8Array).to.be.true
            const deserialized = deserializeWalletBackup(serialized)
            expect(deserialized).to.eql(backup)
        })
    })
})
