class RepositoryScheduler {
    constructor() {
        this.githubToken = null;
        this.user = null;
        this.scheduledRepos = JSON.parse(localStorage.getItem('scheduledRepos') || '[]');
        this.checkInterval = null;
        this.timerInterval = null;
        
        this.initializeTheme();
        this.bindEvents();
        this.loadScheduledRepos();
        // Note: startScheduleChecker and startTimerUpdater are called in init() after auth check
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    bindEvents() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Authentication
        document.getElementById('authenticateBtn').addEventListener('click', () => {
            this.authenticate();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Schedule repository
        document.getElementById('scheduleBtn').addEventListener('click', () => {
            this.scheduleRepository();
        });

        // Force check scheduled repositories
        document.getElementById('forceCheckBtn').addEventListener('click', () => {
            this.forceCheckScheduledRepos();
        });

        // Toast close
        document.getElementById('toastClose').addEventListener('click', () => {
            this.hideToast();
        });

        // Set minimum date to current date
        const now = new Date();
        const currentDateTime = now.toISOString().slice(0, 16);
        document.getElementById('scheduleDate').min = currentDateTime;
        document.getElementById('scheduleDate').value = currentDateTime;
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }

    async authenticate() {
        const token = document.getElementById('githubToken').value.trim();
        
        if (!token) {
            this.showToast('Please enter your GitHub token', 'error');
            return;
        }

        try {
            this.showLoading('authenticateBtn');
            
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('Invalid token or authentication failed');
            }

            const userData = await response.json();
            
            this.githubToken = token;
            this.user = userData;
            
            localStorage.setItem('githubToken', token);
            localStorage.setItem('userData', JSON.stringify(userData));
            
            this.showUserInterface();
            this.showToast('Successfully authenticated!', 'success');
            
        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            this.hideLoading('authenticateBtn');
        }
    }

    logout() {
        this.githubToken = null;
        this.user = null;
        
        localStorage.removeItem('githubToken');
        localStorage.removeItem('userData');
        
        this.showAuthInterface();
        this.showToast('Logged out successfully', 'success');
    }

    showAuthInterface() {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('schedulerSection').style.display = 'none';
        document.getElementById('githubToken').value = '';
    }

    showUserInterface() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('schedulerSection').style.display = 'block';
        
        // Update user info
        document.getElementById('userAvatar').src = this.user.avatar_url;
        document.getElementById('userName').textContent = this.user.name || this.user.login;
        document.getElementById('userLogin').textContent = `@${this.user.login}`;
    }

    async scheduleRepository() {
        const repoName = document.getElementById('repoName').value.trim();
        const repoDescription = document.getElementById('repoDescription').value.trim();
        const scheduleDate = new Date(document.getElementById('scheduleDate').value);
        const isPrivate = document.getElementById('isPrivate').checked;
        const initWithReadme = document.getElementById('initWithReadme').checked;
        const gitignoreTemplate = document.getElementById('gitignoreTemplate').value;

        if (!repoName) {
            this.showToast('Please enter a repository name', 'error');
            return;
        }

        if (scheduleDate <= new Date()) {
            this.showToast('Schedule date must be in the future', 'error');
            return;
        }

        // Check if repo name already exists in scheduled repos
        if (this.scheduledRepos.some(repo => repo.name === repoName)) {
            this.showToast('A repository with this name is already scheduled', 'error');
            return;
        }

        const scheduledRepo = {
            id: Date.now().toString(),
            name: repoName,
            description: repoDescription,
            scheduledDate: scheduleDate.toISOString(),
            private: isPrivate,
            auto_init: initWithReadme,
            gitignore_template: gitignoreTemplate || null,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        this.scheduledRepos.push(scheduledRepo);
        this.saveScheduledRepos();
        this.loadScheduledRepos();
        this.clearForm();
        
        this.showToast(`Repository "${repoName}" scheduled for ${scheduleDate.toLocaleString()}`, 'success');
    }

    clearForm() {
        document.getElementById('repoName').value = '';
        document.getElementById('repoDescription').value = '';
        document.getElementById('isPrivate').checked = true;
        document.getElementById('initWithReadme').checked = true;
        document.getElementById('gitignoreTemplate').value = '';
        
        // Set to current time
        const now = new Date();
        const currentDateTime = now.toISOString().slice(0, 16);
        document.getElementById('scheduleDate').value = currentDateTime;
    }

    saveScheduledRepos() {
        localStorage.setItem('scheduledRepos', JSON.stringify(this.scheduledRepos));
    }

    loadScheduledRepos() {
        const reposList = document.getElementById('reposList');
        
        if (this.scheduledRepos.length === 0) {
            reposList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <h4>No scheduled repositories</h4>
                    <p>Schedule your first repository above to get started.</p>
                </div>
            `;
            return;
        }

        // Sort by scheduled date
        const sortedRepos = [...this.scheduledRepos].sort((a, b) => 
            new Date(a.scheduledDate) - new Date(b.scheduledDate)
        );

        reposList.innerHTML = sortedRepos.map(repo => `
            <div class="repo-item">
                <div class="repo-info">
                    <h4>${repo.name}</h4>
                    ${repo.description ? `<p><strong>Description:</strong> ${repo.description}</p>` : ''}
                    <p><strong>Scheduled:</strong> ${new Date(repo.scheduledDate).toLocaleString()}</p>
                    <p><strong>Visibility:</strong> ${repo.private ? 'Private' : 'Public'}</p>
                    ${repo.gitignore_template ? `<p><strong>Gitignore:</strong> ${repo.gitignore_template}</p>` : ''}
                    ${repo.status === 'pending' ? `
                        <div class="countdown-timer" id="timer-${repo.id}">
                            ${this.calculateCountdown(repo.scheduledDate)}
                        </div>
                    ` : ''}
                </div>
                <div class="repo-actions">
                    <div class="repo-status ${repo.status}">
                        ${this.getStatusIcon(repo.status)}
                        ${repo.status.charAt(0).toUpperCase() + repo.status.slice(1)}
                    </div>
                    ${repo.status === 'pending' ? `
                        <button class="btn btn-danger btn-sm" onclick="repositoryScheduler.removeScheduledRepo('${repo.id}')">
                            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                            </svg>
                            Cancel
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="repositoryScheduler.createRepositoryNow('${repo.id}')">
                            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 6v6l4 4"/>
                            </svg>
                            Create Now
                        </button>
                    ` : ''}
                    ${repo.status === 'created' && repo.html_url ? `
                        <a href="${repo.html_url}" target="_blank" class="btn btn-primary btn-sm">
                            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15,3 21,3 21,9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                            View Repo
                        </a>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    calculateCountdown(scheduledDate) {
        const now = new Date();
        const scheduled = new Date(scheduledDate);
        const timeDiff = scheduled - now;

        if (timeDiff <= 0) {
            return 'Creating now...';
        }

        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        let countdown = '';
        
        if (days > 0) {
            countdown += `${days}d `;
        }
        if (hours > 0 || days > 0) {
            countdown += `${hours}h `;
        }
        if (minutes > 0 || hours > 0 || days > 0) {
            countdown += `${minutes}m `;
        }
        countdown += `${seconds}s`;

        return countdown.trim();
    }

    startTimerUpdater() {
        // Update timers every second
        this.timerInterval = setInterval(() => {
            this.updateTimers();
        }, 1000);
    }

    updateTimers() {
        const pendingRepos = this.scheduledRepos.filter(repo => repo.status === 'pending');
        
        pendingRepos.forEach(repo => {
            const timerElement = document.getElementById(`timer-${repo.id}`);
            if (timerElement) {
                const countdown = this.calculateCountdown(repo.scheduledDate);
                timerElement.textContent = countdown;
                
                // Add urgent class if less than 1 hour remaining
                const now = new Date();
                const scheduled = new Date(repo.scheduledDate);
                const timeDiff = scheduled - now;
                
                if (timeDiff <= 3600000 && timeDiff > 0) { // 1 hour in milliseconds
                    timerElement.classList.add('urgent');
                } else {
                    timerElement.classList.remove('urgent');
                }
            }
        });
    }

    getStatusIcon(status) {
        switch (status) {
            case 'pending':
                return '<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>';
            case 'creating':
                return '<svg class="status-icon loading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>';
            case 'created':
                return '<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>';
            case 'failed':
                return '<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
            default:
                return '<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>';
        }
    }

    removeScheduledRepo(repoId) {
        this.scheduledRepos = this.scheduledRepos.filter(repo => repo.id !== repoId);
        this.saveScheduledRepos();
        this.loadScheduledRepos();
        this.showToast('Scheduled repository cancelled', 'success');
    }

    async createRepositoryNow(repoId) {
        const repo = this.scheduledRepos.find(r => r.id === repoId);
        if (!repo) {
            this.showToast('Repository not found', 'error');
            return;
        }

        if (!this.githubToken) {
            this.showToast('Please authenticate with GitHub first', 'error');
            return;
        }

        await this.createRepository(repo);
    }

    async forceCheckScheduledRepos() {
        this.showToast('Checking for scheduled repositories...', 'info');
        await this.checkScheduledRepos();
    }

    startScheduleChecker() {
        // Check every 10 seconds for repositories that need to be created (more frequent)
        this.checkInterval = setInterval(() => {
            this.checkScheduledRepos();
        }, 10000); // 10 seconds instead of 60 seconds

        // Also check immediately
        this.checkScheduledRepos();
    }

    async checkScheduledRepos() {
        
        if (!this.githubToken) {
            // Show a toast notification if there are pending repos but no token
            const pendingRepos = this.scheduledRepos.filter(repo => repo.status === 'pending');
            if (pendingRepos.length > 0) {
                this.showToast('GitHub authentication required to create scheduled repositories', 'error');
            }
            return;
        }

        const now = new Date();
        const reposToCreate = this.scheduledRepos.filter(repo => {
            const isPending = repo.status === 'pending';
            const scheduledTime = new Date(repo.scheduledDate);
            const isTimeToCreate = scheduledTime <= now;
            
            console.log(`Repository "${repo.name}":`, {
                status: repo.status,
                scheduledTime: scheduledTime.toISOString(),
                currentTime: now.toISOString(),
                isPending,
                isTimeToCreate,
                shouldCreate: isPending && isTimeToCreate
            });
            
            return isPending && isTimeToCreate;
        });


        for (const repo of reposToCreate) {
            await this.createRepository(repo);
        }
        
    }

    async createRepository(repoData) {
        try {
            
            // Update status to processing
            const repoIndex = this.scheduledRepos.findIndex(r => r.id === repoData.id);
            if (repoIndex === -1) {
                console.error('Repository not found in scheduled repos');
                return;
            }

            this.scheduledRepos[repoIndex].status = 'creating';
            this.saveScheduledRepos();
            this.loadScheduledRepos();

            const requestBody = {
                name: repoData.name,
                description: repoData.description || undefined,
                private: repoData.private,
                auto_init: repoData.auto_init
            };

            if (repoData.gitignore_template) {
                requestBody.gitignore_template = repoData.gitignore_template;
            }


            const response = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });


            if (!response.ok) {
                const error = await response.json();
                console.error('GitHub API error:', error);
                throw new Error(error.message || 'Failed to create repository');
            }

            const createdRepo = await response.json();

            // Update the scheduled repo with success status
            this.scheduledRepos[repoIndex].status = 'created';
            this.scheduledRepos[repoIndex].html_url = createdRepo.html_url;
            this.scheduledRepos[repoIndex].createdAt = new Date().toISOString();
            
            this.saveScheduledRepos();
            this.loadScheduledRepos();
            
            this.showToast(`Repository "${repoData.name}" created successfully!`, 'success');

        } catch (error) {
            console.error('Error creating repository:', error);
            
            // Update status to failed
            const repoIndex = this.scheduledRepos.findIndex(r => r.id === repoData.id);
            if (repoIndex !== -1) {
                this.scheduledRepos[repoIndex].status = 'failed';
                this.scheduledRepos[repoIndex].error = error.message;
                this.saveScheduledRepos();
                this.loadScheduledRepos();
            }
            
            this.showToast(`Failed to create repository "${repoData.name}": ${error.message}`, 'error');
        }
    }

    showLoading(buttonId) {
        const button = document.getElementById(buttonId);
        button.disabled = true;
        button.innerHTML = button.innerHTML.replace(/^.*?(<svg.*<\/svg>)/, '<div class="loading"></div>$1');
    }

    hideLoading(buttonId) {
        const button = document.getElementById(buttonId);
        button.disabled = false;
        
        // Restore original button content based on button ID
        const originalContent = {
            'authenticateBtn': `
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4m-5-4l4-4-4-4m5 8H3"/>
                </svg>
                Authenticate
            `
        };
        
        if (originalContent[buttonId]) {
            button.innerHTML = originalContent[buttonId];
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('statusToast');
        const toastMessage = document.getElementById('toastMessage');
        
        toastMessage.textContent = message;
        
        // Remove existing type classes
        toast.classList.remove('toast-success', 'toast-error');
        
        // Add new type class
        if (type === 'success') {
            toast.classList.add('toast-success');
        } else if (type === 'error') {
            toast.classList.add('toast-error');
        }
        
        toast.classList.add('show');
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            this.hideToast();
        }, 5000);
    }

    hideToast() {
        const toast = document.getElementById('statusToast');
        toast.classList.remove('show');
    }

    // Initialize on page load
    init() {
        // Check if user was previously authenticated
        const savedToken = localStorage.getItem('githubToken');
        const savedUserData = localStorage.getItem('userData');
        
        if (savedToken && savedUserData) {
            this.githubToken = savedToken;
            this.user = JSON.parse(savedUserData);
            this.showUserInterface();
        } else {
            this.showAuthInterface();
        }
        
        // Start scheduler after authentication is checked
        this.startScheduleChecker();
        this.startTimerUpdater();
    }
}

// Initialize the application
const repositoryScheduler = new RepositoryScheduler();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    repositoryScheduler.init();
});

// Clean up intervals on page unload
window.addEventListener('beforeunload', () => {
    if (repositoryScheduler.checkInterval) {
        clearInterval(repositoryScheduler.checkInterval);
    }
    if (repositoryScheduler.timerInterval) {
        clearInterval(repositoryScheduler.timerInterval);
    }
});
