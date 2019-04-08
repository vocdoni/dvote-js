enum TextPurpose {
    entityName = "entity-name",
    languages = "languages",
    meta = "meta",
    votingContract = "voting-contract",
    gatewayUpdate = "gateway-update",
    processIds = "process-ids", // * has attributes
    newsFeed = "news-feed", // * has attributes
    entityDescription = "entity-description", // * has attributes
    avatar = "avatar", // * has attributes
}

const keyPrefix = "vnd.vocdoni"

export default class EntityKeysUtil {

    public get(purpose: TextPurpose, attribute?: string) {
        return keyPrefix + purpose + attribute
    }

}
