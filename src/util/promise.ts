/**
 * This function emulates the Promise.allSettled()
 *
 * @param proms
 */
export function allSettled(proms: Array<Promise<any>>) {
    return Promise.all(proms.map(reflect))
}

export function reflect<T>(prom: Promise<T>) {
    return prom
        .then((value: T) => ({ value, status: "fulfilled" }))
        .catch((reason: T) => ({ reason, status: "rejected" }))
}
