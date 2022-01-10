const fs = require("fs");
const path = require("path");

try {
    const startPath = path.dirname(require.resolve("snarkjs"));
    const packagePath = findSnarkJsPackageFile(startPath);
    const packageJson = require(packagePath);

    if (packageJson.name !== "snarkjs") {
        throw new Error("Cannot find the snarkjs package.json file");
    } else if (!packageJson.module) {
        process.exit(0);
    }

    delete packageJson.module;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
} catch (err) {
    console.error(err);
    process.exit(1);
}

// Helpers

function findSnarkJsPackageFile(basePath) {
    while (!fs.existsSync(path.join(basePath, "package.json"))) {
        const basePathItems = basePath.split(path.sep);
        basePathItems.pop();

        if (basePathItems.length === 0 || !basePathItems.includes("snarkjs")) {
            throw new Error("Cannot find the snarkjs package.json file");
        }
        basePath = basePathItems.join(path.sep);
    }
    return path.join(basePath, "package.json");
}
