import { ProcessMetadata } from "../process"
import { ProcessMode, ProcessEnvelopeType } from "dvote-solidity"

export const ProcessMetadataTemplate: ProcessMetadata = {
    version: "1.0",
    mode: ProcessMode.make(),
    envelopeType: ProcessEnvelopeType.make(),
    startBlock: 10000, // Block number on the votchain since the process will be open
    blockCount: 400,
    census: {
        merkleRoot: "", // 0x1234...
        merkleTree: "" // ipfs://12345678,https://server/file!12345678
    },
    details: {
        entityId: "", // 0x1234
        title: {
            default: "" // Universal Basic Income
        },
        description: {
            default: "" // ## Markdown text goes here\n### Abstract
        },
        headerImage: "https://source.unsplash.com/random/800x600", // Content URI
        streamUrl: "",
        questions: [
            {
                type: "single-choice",
                question: {
                    default: "" // Should universal basic income become a human right?
                },
                description: {
                    default: "" // ## Markdown text goes here\n### Abstract
                },
                voteOptions: [
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
}
