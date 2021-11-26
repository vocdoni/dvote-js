import * as latinize from "latinize"

export function normalizeText(text: string): string {
    if (!text) return text
    else if (typeof text != "string") return null

    const result = text
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[\.·:]/g, ".")
        .replace(/[`´]/g, "'")
        .toLowerCase()

    return latinize(result)
}
