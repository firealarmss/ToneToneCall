const fs = require('fs');
const yaml = require('js-yaml');

function loadConfig(configPath) {
    try {
        const configFile = fs.readFileSync(configPath, 'utf8');
        return yaml.load(configFile);
    } catch (error) {
        console.error('Error loading configuration file:', error);
        process.exit(1);
    }
}

module.exports = loadConfig;