const fs = require('fs-extra');
const path = require('path');

class WebToServiceSync {
    constructor() {
        // Data files should be in tools root directory, not service subdirectory
        this.serviceDataFile = path.join(__dirname, '..', 'scheduled-repos.json');
        this.serviceConfigFile = path.join(__dirname, '..', 'config.json');
    }

    async syncFromLocalStorage(githubToken, scheduledRepos) {
        try {
            // Save GitHub token to config
            const config = { githubToken };
            await fs.writeJson(this.serviceConfigFile, config, { spaces: 2 });

            // Convert web app format to service format
            const serviceRepos = scheduledRepos.map(repo => ({
                id: repo.id,
                name: repo.name,
                description: repo.description || '',
                scheduledDate: repo.scheduledDate,
                private: repo.private || false,
                auto_init: repo.auto_init !== false,
                gitignore_template: repo.gitignore_template || null,
                status: repo.status || 'pending',
                createdAt: repo.createdAt || new Date().toISOString(),
                html_url: repo.html_url || null,
                error: repo.error || null
            }));

            // Save repositories to service data file
            await fs.writeJson(this.serviceDataFile, serviceRepos, { spaces: 2 });

            return {
                success: true,
                tokenSynced: !!githubToken,
                repositoriesSynced: serviceRepos.length
            };

        } catch (error) {
            console.error(' Error syncing data to service:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getServiceData() {
        try {
            let config = {};
            let repos = [];

            if (await fs.pathExists(this.serviceConfigFile)) {
                config = await fs.readJson(this.serviceConfigFile);
            }

            if (await fs.pathExists(this.serviceDataFile)) {
                repos = await fs.readJson(this.serviceDataFile);
            }

            return {
                success: true,
                config,
                repositories: repos
            };

        } catch (error) {
            console.error(' Error reading service data:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// If called directly from command line
if (require.main === module) {
    const sync = new WebToServiceSync();
    
    // Example usage - you would call this from your web app
}

module.exports = WebToServiceSync;
