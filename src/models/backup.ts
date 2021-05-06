import { Symmetric } from "../util/encryption"
import { Wallet, WalletBackup, Account } from "../models/protobuf"
import {
    walletBackup_Recovery_QuestionEnumToJSON,
    walletBackup_Recovery_QuestionEnumFromJSON,
    WalletBackup_Recovery_QuestionEnum,
} from "./protobuf/build/ts/client-store/backup"
import { Buffer } from "buffer/"
import { date } from "yup"

const normalizeAnswer = (answer: string): string => answer.replace(/\s+/g, '').toLowerCase()

const normalizeKey = (password: string, answers: string[]): string => {
    const normalized = answers.map(normalizeAnswer).join('')
    return `${password}${normalized}`
}

export class AccountBackup {
    static create(name: string, questionIds: number[], answers: string[], encryptedPassphrase: Uint8Array, wallet: Wallet) {
        if (!AccountBackup.areValidQuestions(questionIds)) {
            throw new Error('Invalid questions provided')
        }
        // if (accountBackup_AuthFromJSON(encryptedPassphrase) === AccountBackup_Auth.UNRECOGNIZED) {
        //     throw new Error('Unrecognized auth type')
        // }
        if (questionIds.length !== answers.length) {
            throw new Error('The number of answers and questions does not match')
        }

        const backup: WalletBackup = {
            name,
            timestamp: Date.now(),
            wallet,
            passphraseRecovery: {
                questionIds,
                encryptedPassphrase
            }
        }

        return AccountBackup.serialize(backup)
    }

    static restore(backup: WalletBackup) : Account {

    }

    static decryptKey(backup: Uint8Array, password: string, answers: string[]): Uint8Array {
        return Symmetric.decryptRaw(Buffer.from(backup), normalizeKey(password, answers))
    }

    /**
     * Retrieve a set of question texts.
     * If the questionIds parameter is empty then all the available questions are returned
     *
     * @param questionIds An array with the requested ID
     * @returns Object containing the id of the questions as keys and their varname as value
     */
    static getQuestionsText(questionIds: WalletBackup_Recovery_QuestionEnum[]): { [key: number]: string } {
        if (!questionIds.length) {
            //TODO get all questions
        }
        const questions = {}

        questionIds.forEach(q => {
            if (q === WalletBackup_Recovery_QuestionEnum.UNRECOGNIZED)
                throw new Error('Invalid question found')
            questions[q] = walletBackup_Recovery_QuestionEnumToJSON(q)
        })

        return questions
    }

    static areValidQuestions(questions: number[]) {
        if (questions.some(q => walletBackup_Recovery_QuestionEnumFromJSON(q) === WalletBackup_Recovery_QuestionEnum.UNRECOGNIZED))
            return false

        return true
    }

    static serialize(data: WalletBackup): Uint8Array {
        return WalletBackup.encode(data).finish()
    }

    static deserialize(bytes: Uint8Array): WalletBackup {
        return WalletBackup.decode(bytes)
    }
}
