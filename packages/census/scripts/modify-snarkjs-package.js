const fs = require('fs');
const path = require('path');

let packagePath = path.dirname(require.resolve("snarkjs"));

while(!fs.existsSync(packagePath + '/package.json')) {
    packagePath = packagePath.split('/');
    packagePath.pop();
    if(packagePath.length === 0) return;
    packagePath = packagePath.join('/')
}
packagePath += '/package.json'

const json = require(packagePath);

if (json.hasOwnProperty('module')) {
    delete json.module;
    fs.writeFileSync(packagePath, JSON.stringify(json, null, 2));
}
