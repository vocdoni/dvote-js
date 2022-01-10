const fs = require('fs');
const path = require('path');

let packagePath = path.dirname(require.resolve("snarkjs"));

while(!fs.existsSync(path.join(packagePath, "package.json"))) {
    const packagePathSplit = packagePath.split(path.sep);
    packagePathSplit.pop();
    if(packagePath.length === 0 || !packagePath.includes("snarkjs")) {
        console.error("Snarkjs dependency not found");
        process.exit(1);
    }
    packagePath = packagePathSplit.join(path.sep)
}
packagePath = path.join(packagePath, "package.json")

const packageJson = require(packagePath);

if (packageJson.hasOwnProperty('module')) {
    delete packageJson.module;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
}
