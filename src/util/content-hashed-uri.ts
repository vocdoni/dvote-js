import ContentURI from "./content-uri"
import { sha3_256 } from 'js-sha3'
import { Buffer } from 'buffer'

export default class ContentHashedURI extends ContentURI {
    protected _hash: string

    /**
     * Parses the given string into a Content Hashed URI.
     * If the hash term is not provided, a normal Content URI will be created
     * */
    constructor(contentHashedUri: string) {
        if (typeof contentHashedUri != "string") throw new Error("Invalid contentHashedUri");

        const terms = contentHashedUri.split("!")
        if (!terms || !terms.length) throw new Error("Invalid contentHashedUri")
        else if (terms.length > 2) throw new Error("Invalid contentHashedUri")

        super(terms[0]) // Set the Content URI

        if (terms[1]) {
            this._hash = terms[1]
        }
    }

    /** Returns the Content Hashed URI as a string representation */
    public toString(): string { return super.toString() + "!" + this._hash }

    /** Returns the string representation of the Content URI without the hash term */
    public toContentUriString(): string { return super.toString() }

    /** Returns the hash on the content referenced by the underlying Content URI */
    public get hash(): string { return this._hash || null }

    public setHashFrom(data: string | Uint8Array | Buffer | number[]) {
        this._hash = ContentHashedURI.hashFrom(data)
    }

    /** Computes the SHA3 256 hash of the content provided */
    static hashFrom(data: string | Uint8Array | Buffer | number[]): string {
        return sha3_256(data)
    }
}
