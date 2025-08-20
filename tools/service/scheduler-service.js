const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const schedule = require('node-schedule');

class RepositorySchedulerService {
    constructor() {
        // Data files should be in tools root directory for easy access
        this.dataFile = path.join(__dirname, '..', 'scheduled-repos.json');
        this.configFile = path.join(__dirname, '..', 'config.json');
        this.scheduledJobs = new Map();
        
        this.loadConfig();
        this.loadScheduledRepos();
        this.scheduleExistingRepos();
        
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                this.config = fs.readJsonSync(this.configFile);
            } else {
                this.config = { githubToken: null };
                this.saveConfig();
            }
        } catch (error) {
            console.error(' Error loading config:', error.message);
            this.config = { githubToken: null };
        }
    }

    saveConfig() {
        try {
            fs.writeJsonSync(this.configFile, this.config, { spaces: 2 });
        } catch (error) {
            console.error(' Error saving config:', error.message);
        }
    }

    loadScheduledRepos() {
        try {
            if (fs.existsSync(this.dataFile)) {
                this.scheduledRepos = fs.readJsonSync(this.dataFile);
            } else {
                this.scheduledRepos = [];
                this.saveScheduledRepos();
            }
        } catch (error) {
            console.error(' Error loading scheduled repos:', error.message);
            this.scheduledRepos = [];
        }
    }

    saveScheduledRepos() {
        try {
            fs.writeJsonSync(this.dataFile, this.scheduledRepos, { spaces: 2 });
        } catch (error) {
            console.error(' Error saving scheduled repos:', error.message);
        }
    }

    setGithubToken(token) {
        this.config.githubToken = token;
        this.saveConfig();
    }

    addScheduledRepo(repoData) {
        const repo = {
            id: Date.now().toString(),
            name: repoData.name,
            description: repoData.description || '',
            scheduledDate: repoData.scheduledDate,
            private: repoData.private || false,
            auto_init: repoData.auto_init !== false,
            gitignore_template: repoData.gitignore_template || null,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        this.scheduledRepos.push(repo);
        this.saveScheduledRepos();
        this.scheduleRepo(repo);
        
        return repo;
    }

    scheduleExistingRepos() {
        const pendingRepos = this.scheduledRepos.filter(repo => repo.status === 'pending');
        
        pendingRepos.forEach(repo => {
            this.scheduleRepo(repo);
        });
    }

    scheduleRepo(repo) {
        const scheduledDate = new Date(repo.scheduledDate);
        
        // If the scheduled time has already passed, create immediately
        if (scheduledDate <= new Date()) {
            setTimeout(() => this.createRepository(repo), 1000);
            return;
        }

        // Schedule the job
        const job = schedule.scheduleJob(scheduledDate, () => {
            this.createRepository(repo);
        });

        if (job) {
            this.scheduledJobs.set(repo.id, job);
        } else {
            console.error(` Failed to schedule repository "${repo.name}"`);
        }
    }

    async createRepository(repo) {
        try {
            
            if (!this.config.githubToken) {
                throw new Error('No GitHub token configured');
            }

            // Update status
            const repoIndex = this.scheduledRepos.findIndex(r => r.id === repo.id);
            if (repoIndex === -1) {
                throw new Error('Repository not found in scheduled list');
            }

            this.scheduledRepos[repoIndex].status = 'creating';
            this.saveScheduledRepos();

            const requestBody = {
                name: repo.name,
                description: repo.description || undefined,
                private: repo.private,
                auto_init: repo.auto_init
            };

            if (repo.gitignore_template) {
                requestBody.gitignore_template = repo.gitignore_template;
            }

            const response = await axios.post('https://api.github.com/user/repos', requestBody, {
                headers: {
                    'Authorization': `token ${this.config.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                }
            });

            // Update with success
            this.scheduledRepos[repoIndex].status = 'created';
            this.scheduledRepos[repoIndex].html_url = response.data.html_url;
            this.scheduledRepos[repoIndex].actualCreatedAt = new Date().toISOString();
            this.saveScheduledRepos();

            // Clean up the scheduled job
            if (this.scheduledJobs.has(repo.id)) {
                this.scheduledJobs.get(repo.id).cancel();
                this.scheduledJobs.delete(repo.id);
            }


        } catch (error) {
            console.error(` Failed to create repository "${repo.name}":`, error.message);
            
            // Update with failure
            const repoIndex = this.scheduledRepos.findIndex(r => r.id === repo.id);
            if (repoIndex !== -1) {
                this.scheduledRepos[repoIndex].status = 'failed';
                this.scheduledRepos[repoIndex].error = error.message;
                this.scheduledRepos[repoIndex].failedAt = new Date().toISOString();
                this.saveScheduledRepos();
            }

            // Clean up the scheduled job
            if (this.scheduledJobs.has(repo.id)) {
                this.scheduledJobs.get(repo.id).cancel();
                this.scheduledJobs.delete(repo.id);
            }
        }
    }

    removeScheduledRepo(repoId) {
        // Cancel the scheduled job if it exists
        if (this.scheduledJobs.has(repoId)) {
            this.scheduledJobs.get(repoId).cancel();
            this.scheduledJobs.delete(repoId);
        }

        // Remove from scheduled repos
        this.scheduledRepos = this.scheduledRepos.filter(repo => repo.id !== repoId);
        this.saveScheduledRepos();
        
    }

    listScheduledRepos() {
        
        if (this.scheduledRepos.length === 0) {
            return;
        }

        this.scheduledRepos.forEach((repo, index) => {
            if (repo.html_url) {
            }
            if (repo.error) {
            }
        });
    }

    getStats() {
        const pending = this.scheduledRepos.filter(r => r.status === 'pending').length;
        const created = this.scheduledRepos.filter(r => r.status === 'created').length;
        const failed = this.scheduledRepos.filter(r => r.status === 'failed').length;
        const creating = this.scheduledRepos.filter(r => r.status === 'creating').length;

        return { pending, created, failed, creating, total: this.scheduledRepos.length };
    }

    shutdown() {
        
        // Cancel all scheduled jobs
        this.scheduledJobs.forEach((job, repoId) => {
            job.cancel();
        });
        
        this.scheduledJobs.clear();
    }
}

module.exports = RepositorySchedulerService;
