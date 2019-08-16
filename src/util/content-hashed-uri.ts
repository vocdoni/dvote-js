import ContentURI from "./content-uri"

export default class ContentHashedURI extends ContentURI {
    protected _hash: string

    /** Parses the given string into a Content Hashed URI */
    constructor(contentHashedUri: string) {
        if (typeof contentHashedUri != "string") throw new Error("Invalid contentHashedUri");

        const terms = contentHashedUri.split("!")
        if (!terms || terms.length != 2) throw new Error("Invalid contentHashedUri")

        super(terms[0]) // Set the Content URI

        this._hash = terms[1]
    }

    /** Returns the Content Hashed URI as a string representation */
    toString(): string { return super.toString() + "!" + this._hash }

    /** Returns the hash on the content referenced by the underlying Content URI */
    hash(): string { return this._hash }
}
