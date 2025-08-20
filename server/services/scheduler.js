const fs = require('fs-extra');
const path = require('path');
const schedule = require('node-schedule');
const axios = require('axios');

class SchedulerService {
    constructor() {
        this.dataFile = path.join(__dirname, '../data/repositories.json');
        this.scheduledJobs = new Map();
        this.repositories = [];
        
        this.initializeData();
        this.loadRepositories();
        this.scheduleExistingRepositories();
        
    }

    async initializeData() {
        // Ensure data directory exists
        await fs.ensureDir(path.join(__dirname, '../data'));
        
        // Ensure repositories file exists
        if (!await fs.pathExists(this.dataFile)) {
            await fs.writeJson(this.dataFile, []);
        }
    }

    async loadRepositories() {
        try {
            this.repositories = await fs.readJson(this.dataFile);
        } catch (error) {
            console.error(' Error loading repositories:', error);
            this.repositories = [];
        }
    }

    async saveRepositories() {
        try {
            await fs.writeJson(this.dataFile, this.repositories, { spaces: 2 });
        } catch (error) {
            console.error(' Error saving repositories:', error);
        }
    }

    scheduleExistingRepositories() {
        const pendingRepos = this.repositories.filter(repo => repo.status === 'pending');
        
        pendingRepos.forEach(repo => {
            this.scheduleRepository(repo);
        });
    }

    scheduleRepository(repo) {
        const scheduledDate = new Date(repo.scheduledDate);
        
        // If the scheduled time has already passed, create immediately
        if (scheduledDate <= new Date()) {
            setTimeout(() => this.createRepository(repo.id), 1000);
            return;
        }

        // Schedule the job
        const job = schedule.scheduleJob(scheduledDate, () => {
            this.createRepository(repo.id);
        });

        if (job) {
            this.scheduledJobs.set(repo.id, job);
        } else {
            console.error(` Failed to schedule repository "${repo.name}"`);
        }
    }

    async addRepository(repoData) {
        try {
            // Add to repositories array
            this.repositories.push(repoData);
            await this.saveRepositories();
            
            // Schedule the repository
            this.scheduleRepository(repoData);
            
            return repoData;
        } catch (error) {
            console.error('Error adding repository:', error);
            throw error;
        }
    }

    async updateRepository(repoId, updateData) {
        try {
            const repoIndex = this.repositories.findIndex(r => r.id === repoId);
            if (repoIndex === -1) {
                throw new Error('Repository not found');
            }

            const repo = this.repositories[repoIndex];
            
            // Cancel existing job if scheduled date is changing
            if (updateData.scheduledDate && this.scheduledJobs.has(repoId)) {
                this.scheduledJobs.get(repoId).cancel();
                this.scheduledJobs.delete(repoId);
            }

            // Update repository data
            Object.assign(repo, updateData);
            await this.saveRepositories();

            // Reschedule if still pending and scheduled date changed
            if (repo.status === 'pending' && updateData.scheduledDate) {
                this.scheduleRepository(repo);
            }

            return repo;
        } catch (error) {
            console.error('Error updating repository:', error);
            throw error;
        }
    }

    async removeRepository(repoId) {
        try {
            // Cancel scheduled job if exists
            if (this.scheduledJobs.has(repoId)) {
                this.scheduledJobs.get(repoId).cancel();
                this.scheduledJobs.delete(repoId);
            }

            // Remove from repositories array
            this.repositories = this.repositories.filter(repo => repo.id !== repoId);
            await this.saveRepositories();
            
        } catch (error) {
            console.error('Error removing repository:', error);
            throw error;
        }
    }

    async createRepository(repoId) {
        try {
            const repoIndex = this.repositories.findIndex(r => r.id === repoId);
            if (repoIndex === -1) {
                console.error(`Repository with ID ${repoId} not found`);
                return;
            }

            const repo = this.repositories[repoIndex];

            // Update status to creating
            repo.status = 'creating';
            await this.saveRepositories();

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
                    'Authorization': `token ${repo.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                }
            });

            // Update with success
            repo.status = 'created';
            repo.html_url = response.data.html_url;
            repo.github_id = response.data.id;
            repo.actualCreatedAt = new Date().toISOString();
            await this.saveRepositories();

            // Clean up the scheduled job
            if (this.scheduledJobs.has(repoId)) {
                this.scheduledJobs.get(repoId).cancel();
                this.scheduledJobs.delete(repoId);
            }


        } catch (error) {
            console.error(` Failed to create repository:`, error.response?.data || error.message);
            
            // Update with failure
            const repoIndex = this.repositories.findIndex(r => r.id === repoId);
            if (repoIndex !== -1) {
                this.repositories[repoIndex].status = 'failed';
                this.repositories[repoIndex].error = error.response?.data?.message || error.message;
                this.repositories[repoIndex].failedAt = new Date().toISOString();
                await this.saveRepositories();
            }

            // Clean up the scheduled job
            if (this.scheduledJobs.has(repoId)) {
                this.scheduledJobs.get(repoId).cancel();
                this.scheduledJobs.delete(repoId);
            }
        }
    }

    async createRepositoryNow(repoId) {
        // Create repository immediately, bypassing schedule
        await this.createRepository(repoId);
    }

    async getUserRepositories(userId) {
        return this.repositories
            .filter(repo => repo.userId === userId)
            .map(repo => ({
                id: repo.id,
                name: repo.name,
                description: repo.description,
                scheduledDate: repo.scheduledDate,
                private: repo.private,
                auto_init: repo.auto_init,
                gitignore_template: repo.gitignore_template,
                status: repo.status,
                createdAt: repo.createdAt,
                html_url: repo.html_url,
                actualCreatedAt: repo.actualCreatedAt,
                error: repo.error,
                failedAt: repo.failedAt
            }));
    }

    async getUserRepository(userId, repoId) {
        const repo = this.repositories.find(r => r.id === repoId && r.userId === userId);
        if (!repo) return null;

        return {
            id: repo.id,
            name: repo.name,
            description: repo.description,
            scheduledDate: repo.scheduledDate,
            private: repo.private,
            auto_init: repo.auto_init,
            gitignore_template: repo.gitignore_template,
            status: repo.status,
            createdAt: repo.createdAt,
            html_url: repo.html_url,
            actualCreatedAt: repo.actualCreatedAt,
            error: repo.error,
            failedAt: repo.failedAt
        };
    }

    async getUserStats(userId) {
        const userRepos = this.repositories.filter(repo => repo.userId === userId);
        
        const pending = userRepos.filter(r => r.status === 'pending').length;
        const creating = userRepos.filter(r => r.status === 'creating').length;
        const created = userRepos.filter(r => r.status === 'created').length;
        const failed = userRepos.filter(r => r.status === 'failed').length;

        return {
            total: userRepos.length,
            pending,
            creating,
            created,
            failed
        };
    }

    getStats() {
        const pending = this.repositories.filter(r => r.status === 'pending').length;
        const creating = this.repositories.filter(r => r.status === 'creating').length;
        const created = this.repositories.filter(r => r.status === 'created').length;
        const failed = this.repositories.filter(r => r.status === 'failed').length;

        return {
            total: this.repositories.length,
            pending,
            creating,
            created,
            failed,
            activeJobs: this.scheduledJobs.size
        };
    }

    getActiveJobsCount() {
        return this.scheduledJobs.size;
    }

    getTotalRepositoriesCount() {
        return this.repositories.length;
    }

    shutdown() {
        
        // Cancel all scheduled jobs
        this.scheduledJobs.forEach((job, repoId) => {
            job.cancel();
        });
        
        this.scheduledJobs.clear();
    }
}

module.exports = SchedulerService;
