let testSuites = 0
let failedTests = 0

// A new test file starts executing
function started() {
    testSuites++
}

// A test file completes its execution
function completed() {
    if (--testSuites <= 0) {
        // Exit, keeping the status code
        setImmediate(() => process.exit(Math.min(failedTests, 255)))
    }
}

// An assertion failed
function failed() {
    failedTests++
}

export function addCompletionHooks() {
    // Mocha hooks will run on the context of
    // every spec file calling this function
    before(started)

    after(completed)

    afterEach(function () {
        if (this.currentTest.state === 'failed') {
            failed()
        }
    })
}
