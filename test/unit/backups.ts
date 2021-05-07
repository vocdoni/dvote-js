import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { Wallet } from "ethers"

import { AccountBackup } from "../../src/models/backup"
import { Wallet_AuthMethod } from "../../src"

addCompletionHooks()

describe("Account backups", () => {
  it("Should generate an account backup and recover the original passphrase", () => {
    for (let i = 0; i < 5; i++) {
      const wallet = Wallet.createRandom()
      const originalPassphrase = Math.random().toString()
      const encryptedMnemonic = AccountBackup.encryptPayload(wallet.mnemonic.phrase, originalPassphrase)

      const backupBytes = AccountBackup.create({
        backupName: "Hello " + i,
        questionIds: [1, 2, 3],
        answers: ["Answer 1" + i, "Answer 2" + i, "Answer 3" + i],
        accountWallet: {
          encryptedMnemonic,
          authMethod: Wallet_AuthMethod.PASS,
          hdPath: wallet.mnemonic.path,
          locale: wallet.mnemonic.locale
        },
        currentPassphrase: originalPassphrase
      })
      expect(backupBytes).to.be.ok

      const decryptedPassphrase = AccountBackup.recoverPassphrase(backupBytes, ["Answer 1" + i, "Answer 2" + i, "Answer 3" + i])
      expect(decryptedPassphrase).to.eq(originalPassphrase)

      const parsedBackup = AccountBackup.parse(backupBytes)
      expect(parsedBackup.name).to.eq("Hello " + i)
      expect(parsedBackup.passphraseRecovery.questionIds).to.deep.eq([1, 2, 3])
      expect(parsedBackup.wallet.encryptedMnemonic.join(",")).to.eq(encryptedMnemonic.join(","))
    }
  })

  it("Should fail to back up with a wrong passphrase", () => {
    for (let i = 0; i < 5; i++) {
      const wallet = Wallet.createRandom()
      const originalPassphrase = Math.random().toString()
      const encryptedMnemonic = AccountBackup.encryptPayload(wallet.mnemonic.phrase, originalPassphrase)

      expect(() => {
        AccountBackup.create({
          backupName: "Hello " + i,
          questionIds: [1, 2, 3],
          answers: ["Answer 1" + i, "Answer 2" + i, "Answer 3" + i],
          accountWallet: {
            encryptedMnemonic,
            authMethod: Wallet_AuthMethod.PASS,
            hdPath: wallet.mnemonic.path,
            locale: wallet.mnemonic.locale
          },
          currentPassphrase: "this-is-a-wrong-passphrase-" + Math.random()
        })
      }).to.throw
    }
  })

  it("Should fail to back up when parameters are invalid", () => {
    const wallet = Wallet.createRandom()
    const originalPassphrase = Math.random().toString()
    const encryptedMnemonic = AccountBackup.encryptPayload(wallet.mnemonic.phrase, originalPassphrase)

    // Mismatching lengths
    expect(() => {
      AccountBackup.create({
        backupName: "Hello",
        questionIds: [1, 2, 3, 5, 6, 7],
        answers: ["Answer 1 only"],
        accountWallet: {
          encryptedMnemonic,
          authMethod: Wallet_AuthMethod.PASS,
          hdPath: wallet.mnemonic.path,
          locale: wallet.mnemonic.locale
        },
        currentPassphrase: originalPassphrase
      })
    }).to.throw

    // Mismatching lengths
    expect(() => {
      AccountBackup.create({
        backupName: "Hello",
        questionIds: [1],
        answers: ["Answer 1 only"],
        accountWallet: {
          encryptedMnemonic: [0, 1, 2] as any,
          authMethod: Wallet_AuthMethod.PASS,
          hdPath: wallet.mnemonic.path,
          locale: wallet.mnemonic.locale
        },
        currentPassphrase: originalPassphrase
      })
    }).to.throw
  })

  it("Should fail on mismatch", () => {
    for (let i = 0; i < 5; i++) {
      const wallet = Wallet.createRandom()
      const originalPassphrase = Math.random().toString()
      const encryptedMnemonic = AccountBackup.encryptPayload(wallet.mnemonic.phrase, originalPassphrase)

      const backup = AccountBackup.create({
        backupName: "Hello " + i,
        questionIds: [1, 2, 3],
        answers: ["Answer 1" + i, "Answer 2" + i, "Answer 3" + i],
        accountWallet: {
          encryptedMnemonic,
          authMethod: Wallet_AuthMethod.PASS,
          hdPath: wallet.mnemonic.path,
          locale: wallet.mnemonic.locale
        },
        currentPassphrase: originalPassphrase
      })
      expect(backup).to.be.ok

      expect(() => AccountBackup.recoverPassphrase(backup, ["Wrong 1", "Wrong 2", "Wrong 3"])).to.throw
      expect(() => AccountBackup.recoverPassphrase(backup, ["Wrong 1"])).to.throw
      expect(() => AccountBackup.recoverPassphrase(backup, [])).to.throw
    }
  })
})
