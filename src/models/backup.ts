import { Symmetric } from "../../packages/encryption/src" // TODO: Import from the new NPM package
import { Wallet as PbWallet, WalletBackup, Account as PbAccount } from "../models/protobuf"
import {
    walletBackup_Recovery_QuestionEnumFromJSON,
    WalletBackup_Recovery_QuestionEnum,
} from "./protobuf/build/ts/client-store/backup"
import { Buffer } from "buffer/"
import { normalizeText } from "../util/normalization"

type AccountBackupCreateParams = {
    /** An arbitrary name given to identify the account when restoring */
    backupName: string,
    /** The fields typically stored on the local storage of a browser/app */
    accountWallet: PbWallet,
    /** The passphrase currently used to encrypt the accountWallet's mnemonic */
    currentPassphrase: string,
    /** The index of questions used (in order of usage) */
    questionIds: number[],
    /** The strings given as answer for the corresponding questions */
    answers: string[]
}

export namespace AccountBackup {
    export function create(params: AccountBackupCreateParams): Uint8Array {
        if (!params) throw new Error("Empty parameters")
        const { backupName, accountWallet, currentPassphrase, questionIds, answers } = params

        if (!AccountBackup.areValidQuestions(questionIds))
            throw new Error('Some question id\'s are not valid')
        else if (!questionIds.length || questionIds.length < 2)
            throw new Error('At least two questions should be used')
        else if (questionIds.length !== answers.length)
            throw new Error('The number of answers and questions does not match')

        // Check that the currentPassphrase is correct (throws if incorrect)
        AccountBackup.decryptPayload(accountWallet.encryptedMnemonic, currentPassphrase)

        // Digested answers as key
        const digestedAnswers = AccountBackup.digestAnswers(answers)

        // Encrypt the current passphrase with the digested answers
        const encryptedPassphraseBk = AccountBackup.encryptPayload(currentPassphrase, digestedAnswers)

        const payload: WalletBackup = {
            name: backupName,
            timestamp: Date.now(),
            wallet: accountWallet,
            passphraseRecovery: {
                questionIds,
                encryptedPassphrase: encryptedPassphraseBk
            }
        }
        return WalletBackup.encode(payload).finish()
    }

    /**
     * Uses the given backup bytes and the given answers to decrypt the original passphrase used to
     * secure the encryptedMnemonic on the account wallet
     */
    export function recoverPassphrase(backupBytes: Uint8Array, answers: string[]): string {
        const backup = AccountBackup.parse(backupBytes)

        // Digested answers as key
        const digestedAnswers = AccountBackup.digestAnswers(answers)

        return AccountBackup.decryptPayload(backup.passphraseRecovery.encryptedPassphrase, digestedAnswers)
    }

    /** Used to encrypt either a mnemonic or a passphrase */
    export function encryptPayload(payload: string, key: string): Uint8Array {
        const payloadBytes = Buffer.from(payload, "utf-8")
        return Symmetric.encryptRaw(payloadBytes, key)
    }

    /** Used to encrypt either a mnemonic or a passphrase */
    export function decryptPayload(payloadBytes: Uint8Array, key: string): string {
        return Symmetric.decryptRaw(payloadBytes, key).toString()
    }

    export function digestAnswers(answers: string[]): string {
        return answers.map(normalizeText).join("//")
    }

    export function areValidQuestions(questions: WalletBackup_Recovery_QuestionEnum[]) {
        return questions.every(q => walletBackup_Recovery_QuestionEnumFromJSON(q) !== WalletBackup_Recovery_QuestionEnum.UNRECOGNIZED)
    }

    export function parse(backupBytes: Uint8Array) {
        return WalletBackup.decode(backupBytes)
    }
}
