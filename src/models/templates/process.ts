import { ProcessMetadata } from "../process"

export const ProcessMetadataTemplate: ProcessMetadata = {
    version: "1.1",
    title: {
        default: "" // Universal Basic Income
    },
    description: {
        default: "" // ## Markdown text goes here\n### Abstract
    },
    media: {
        header: "https://source.unsplash.com/random/800x600", // Content URI
        streamUri: "",
    },
    meta: {},
    questions: [
        {
            title: {
                default: "" // Should universal basic income become a human right?
            },
            description: {
                default: "" // ## Markdown text goes here\n### Abstract
            },
            choices: [
                {
                    title: {
                        default: "Yes",
                    },
                    value: 0
                },
                {
                    title: {
                        default: "No",
                    },
                    value: 1
                }
            ]
        }
    ]
}
