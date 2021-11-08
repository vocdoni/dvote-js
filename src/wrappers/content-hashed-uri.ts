import { ContentUri } from "./content-uri"
import { sha256 } from "@ethersproject/sha2"
import { Buffer } from 'buffer/'
import { strip0x } from "../util/hex";

export class ContentHashedUri extends ContentUri {
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
            if (!/^(0x)?[0-9a-fA-F]+$/.test(terms[1])) throw new Error("Invalid hash hex string")
            else if (terms[1].length % 2 != 0) throw new Error("The hash contains an odd length")

            this._hash = strip0x(terms[1])
        }
    }

    /** Returns the Content Hashed URI as a string representation */
    public toString(): string { return super.toString() + "!" + this._hash }

    /** Returns the string representation of the Content URI without the hash term */
    public toContentUriString(): string { return super.toString() }

    /** Returns the hash on the content referenced by the underlying Content URI */
    public get hash(): string { return this._hash || null }

    /** Verifies that the given data produces the current hash */
    public verify(data: Uint8Array | Buffer | number[]) {
        if (!this._hash) throw new Error("The Content URI hash is empty")

        return this._hash == ContentHashedUri.hash(data)
    }

    /** Computes the SHA256 hash of the content provided */
    static hash(data: Uint8Array | Buffer | number[]): string {
        return strip0x(sha256(data))
    }
}
