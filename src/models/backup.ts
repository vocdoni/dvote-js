import { Symmetric } from "../util/encryption"
import { AccountBackupModel } from "../models/protobuf"
import {
    AccountBackup_Auth,
    accountBackup_AuthFromJSON,
    AccountBackup_Questions,
    accountBackup_QuestionsFromJSON,
} from "./protobuf/build/ts/client-store/backup"
import { Buffer } from "buffer/"

const normalizeAnswer = (answer: string): string => answer.replace(/\s+/g, '').toLowerCase()

const normalizeKey = (password: string, answers: string[]) : string => {
    const normalized = answers.map(normalizeAnswer).join('')
    return `${password}${normalized}`
}

export class AccountBackup {
    static create(alias: string, password: string, seed: Uint8Array, questions: number[], answers: string[], auth: string = "PASS") {
        if (!AccountBackup.areValidQuestions(questions)) {
            throw new Error('Invalid questions provided')
        }
        if (accountBackup_AuthFromJSON(auth) === AccountBackup_Auth.UNRECOGNIZED) {
            throw new Error('Unrecognized auth type')
        }
        if (questions.length !== answers.length) {
            throw new Error('The number of answers and questions does not match')
        }

        const backup : AccountBackupModel = {
            alias,
            questions,
            auth: accountBackup_AuthFromJSON(auth),
            key: Symmetric.encryptRaw(
                Buffer.from(seed),
                normalizeKey(password, answers)
            ),
        }

        return AccountBackup.serialize(backup)
    }

    static decryptKey(backup: Uint8Array, password: string, answers: string[]) : Uint8Array {
        return Symmetric.decryptRaw(Buffer.from(backup), normalizeKey(password, answers))
    }

    /**
     * List of currently defined question indexes and their values.
     *
     * @returns Object containing the id of the questions as keys and their varname as value
     */
    static questions(): {[key: number]: string} {
        const keys = Object.values(AccountBackup_Questions)
        const questions = {}

        for (const id in keys) {
            const key = keys[id]
            if (typeof key === 'string' && key !== 'UNRECOGNIZED') {
                questions[id] = key
            }
        }

        return questions
    }

    static areValidQuestions(questions: number[]) {
        for (const question of questions) {
            if (accountBackup_QuestionsFromJSON(question) === AccountBackup_Questions.UNRECOGNIZED) {
                return false
            }
        }

        return true
    }

    static serialize(data: AccountBackupModel): Uint8Array {
        return AccountBackupModel.encode(data).finish()
    }

    static deserialize(bytes: Uint8Array): AccountBackupModel {
        return AccountBackupModel.decode(bytes)
    }
}
