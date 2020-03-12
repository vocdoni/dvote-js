import { EntityMetadata } from "../entity"

export const EntityMetadataTemplate: EntityMetadata = {
    version: "1.0",
    languages: [
        "default"
    ],
    name: {
        default: "My entity",
        // fr: "Ma communauté"
    },
    description: {
        default: "The description of my entity goes here",
        // fr: "La description officielle de ma communauté est ici"
    },
    votingProcesses: {
        active: [],
        ended: []
    },
    newsFeed: {
        default: "ipfs://QmWybQwdBwF81Dt71bNTDDr8PBpW9kNbWtQ64arswaBz1C",
        // fr: "https://feed2json.org/convert?url=http://www.intertwingly.net/blog/index.atom"
    },
    media: {
        avatar: "https://source.unsplash.com/random/800x600",
        header: "https://source.unsplash.com/random/800x600"
    },
    actions: [
        {
            type: "register",
            actionKey: "register",
            name: {
                default: "Sign up",
                // fr: "S'inscrire"
            },
            url: "https://registry.vocdoni.net/api/actions",
            visible: "https://registry.vocdoni.net/api/actions"
        }
    ],
    bootEntities: [],
    fallbackBootNodeEntities: [],
    trustedEntities: [],
    censusServiceManagedEntities: []
}
