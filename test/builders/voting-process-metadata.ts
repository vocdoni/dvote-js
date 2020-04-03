import { ProcessMetadataTemplate, ProcessMetadata, ProcessType } from "../../src/models/voting-process"
import { URI } from "../../src/models/common"
import {
    DEFAULT_PROCESS_TYPE,
    DEFAULT_MERKLE_ROOT,
    DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI,
    DEFAULT_NUMBER_OF_BLOCKS,
    DEFAULT_START_BLOCK
} from "./voting-process"

//BUILDER
export default class ProcessMetadataBuilder {
    private metadata: ProcessMetadata = null
    constructor() {
        this.metadata = JSON.parse(JSON.stringify(ProcessMetadataTemplate))
    }

    get() {
        return this.metadata
    }

    build() {
        this.metadata.type = DEFAULT_PROCESS_TYPE
        this.metadata.numberOfBlocks = DEFAULT_NUMBER_OF_BLOCKS
        this.metadata.startBlock = DEFAULT_START_BLOCK
        this.metadata.census.merkleRoot = DEFAULT_MERKLE_ROOT
        this.metadata.census.merkleTree = DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI
        const details = this.metadata.details
        details.entityId = "0x180dd5765d9f7ecef810b565a2e5bd14a3ccd536c442b3de74867df552855e85"
        details.encryptionPublicKey = "0x04d811f8ade566618a667715c637a7f3019f46ae0ffc8b2ec3b16b1f72999e2e2f9e9b50c78ca34175d78942de88798cce5d53569f96579a95ec9bab17c0131d4f"
        details.title = { default: "My Entity" }
        details.description = { default: "Description" }
        details.questions.map(
            (question, index) => {
                question.question = {default: "Question " +
                                        String(index)}
                question.description = {default: "Description " +
                                        String(index)}
                question.voteOptions.map(
                    (option, index) => {
                        option.title = {default: "Yes " +
                                        String(index)}
                    }
                )
            }
        )
        return this.metadata
    }

    withStreamUrl(url: string) {
        this.metadata.details.streamUrl = url as URI
        return this
    }

    withTypeSnarkVote() {
        this.metadata.type = "snark-vote" as ProcessType
        return this
    }

    withTypePollVote() {
        this.metadata.type = "poll-vote" as ProcessType
        return this
    }

    withTypePetitionSign() {
        this.metadata.type = "petition-sign" as ProcessType
        return this
    }

    withIntegerVoteValues() {
        this.metadata.details.questions.map(
            (question, questionIndex) => {
                question.voteOptions.map(
                    (voteOption, voteIndex) => {
                        voteOption.value = voteIndex
                    })
            }
        )
        return this
    }

    withStringVoteValues() {
        this.metadata.details.questions.map(
            (question, questionIndex) => {
                question.voteOptions.map(
                    (voteOption, voteIndex) => {
                        voteOption.value = String(voteIndex)
                    })
            }
        )
        return this
    }

    withNumberOfQuestions(size: number) {
        const questions = this.metadata.details.questions
        const questionTemplate = JSON.stringify(questions[0])
        for (let i = 0; i < size - 1; i++) {
            questions.push(JSON.parse(questionTemplate))
        }
        return this
    }

    withNumberOfOptions(size: number) {
        // to be used without build
        this.build()
        let options = this.metadata.details.questions[0].voteOptions
        const optionTemplate = JSON.stringify(options[0])
        for (let i = 2; i < size; i++) {
            const option = JSON.parse(optionTemplate)
            option.title = {default: "Yes " + String(i)}
            option.value = i
            options.push(option)
        }
        return this.metadata
    }

}