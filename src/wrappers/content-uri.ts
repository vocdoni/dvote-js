export class ContentUri {
    protected _contentUri: string[];

    /** Parses the given string into a Content URI */
    constructor(contentUri: string) {
        if (typeof contentUri != "string") throw new Error("Invalid contentUri");
        this._contentUri = contentUri.split(",");
    }

    /** Returns the Content URI as a string representation */
    public toString(): string {
        return this._contentUri.join(",")
    }

    /** Returns the individual URI's contained in the Content URI */
    public get items(): string[] { return this._contentUri }

    /** The hash of all IPFS items */
    public get ipfsHash(): string {
        const item = this._contentUri.find(i => i.indexOf("ipfs://") == 0)
        if (!item) return null
        return item.replace(/^ipfs:\/\//, "")
    }

    /** The https endpoints */
    public get httpsItems(): string[] {
        return this._contentUri.filter(i => i.indexOf("https://") == 0)
    }

    /** The http endpoints */
    public get httpItems(): string[] {
        return this._contentUri.filter(i => i.indexOf("http://") == 0)
    }
}
