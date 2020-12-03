/**
 * @param func The promise returning function to invoke
 * @param timeout Timeout (in seconds) to wait before failing
 * @param timeoutMessage (optional) Message to use when throwing a timeout error
 */
export function promiseWithTimeout<T>(func: () => Promise<T>, timeout: number, timeoutMessage?: string): Promise<T> {
    if (typeof func != "function") throw new Error("Invalid function")
    else if (isNaN(timeout) || timeout < 0) throw new Error("Invalid timeout")

    return new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error(timeoutMessage || "Time out")), timeout)

        return func()
            .then(result => resolve(result))
            .catch(err => reject(err))
    })
}
