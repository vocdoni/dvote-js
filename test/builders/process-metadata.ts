import { ProcessMetadataTemplate, ProcessMetadata } from "../../packages/models/src" // TODO: Import from the new NPM package
import { URI } from "../../packages/common/src" // TODO: Import from the new NPM package

// BUILDER
export default class ProcessMetadataBuilder {
    private metadata: ProcessMetadata = null
    constructor() {
        this.metadata = JSON.parse(JSON.stringify(ProcessMetadataTemplate))
    }

    get() {
        return this.metadata
    }

    build() {
        this.metadata.title = { default: "My Entity" }
        this.metadata.description = { default: "Description" }
        this.metadata.questions.forEach(
            (question, index) => {
                question.title = { default: "Question " + String(index) }
                question.description = { default: "Description " + String(index) }
                question.choices.map((option, index) => { option.title = { default: "Yes " + String(index) } })
            }
        )
        return this.metadata
    }

    withStreamUri(uri: string) {
        this.metadata.media.streamUri = uri as URI
        return this
    }

    withMeta(meta: any) {
        this.metadata.meta = meta
        return this
    }

    withNumberOfQuestions(size: number) {
        const questions = this.metadata.questions
        const questionTemplate = JSON.stringify(questions[0])
        for (let i = 0; i < size - 1; i++) {
            questions.push(JSON.parse(questionTemplate))
        }
        return this
    }

    withNumberOfChoices(size: number) {
        // to be used without build
        this.build()
        let choices = this.metadata.questions[0].choices
        const choiceTemplate = JSON.stringify(choices[0])
        for (let i = 2; i < size; i++) {
            const choice = JSON.parse(choiceTemplate)
            choice.title = { default: "Yes " + String(i) }
            choice.value = i
            choices.push(choice)
        }
        return this.metadata
    }
}
