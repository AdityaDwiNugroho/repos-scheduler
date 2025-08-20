#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');


async function setup() {
    try {
        // Create data files if they don't exist
        const configFile = path.join(__dirname, 'config.json');
        const dataFile = path.join(__dirname, 'scheduled-repos.json');

        if (!await fs.pathExists(configFile)) {
            await fs.writeJson(configFile, { githubToken: null }, { spaces: 2 });
        } else {
        }

        if (!await fs.pathExists(dataFile)) {
            await fs.writeJson(dataFile, [], { spaces: 2 });
        } else {
        }


    } catch (error) {
        console.error(' Setup failed:', error.message);
        process.exit(1);
    }
}

setup();
