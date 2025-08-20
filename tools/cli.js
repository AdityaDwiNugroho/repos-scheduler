const RepositorySchedulerService = require('./service/scheduler-service');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const service = new RepositorySchedulerService();

function showMenu() {
}

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function setGithubToken() {
    const token = await askQuestion('Enter your GitHub Personal Access Token: ');
    if (token.trim()) {
        service.setGithubToken(token.trim());
    } else {
    }
}

async function addScheduledRepo() {
    
    const name = await askQuestion('Repository name: ');
    if (!name.trim()) {
        return;
    }

    const description = await askQuestion('Description (optional): ');
    
    const isPrivateInput = await askQuestion('Private repository? (y/N): ');
    const isPrivate = isPrivateInput.toLowerCase() === 'y' || isPrivateInput.toLowerCase() === 'yes';
    
    const initWithReadme = await askQuestion('Initialize with README? (Y/n): ');
    const autoInit = initWithReadme.toLowerCase() !== 'n' && initWithReadme.toLowerCase() !== 'no';
    
    const gitignoreTemplate = await askQuestion('Gitignore template (Node, Python, Java, etc. - optional): ');
    
    const year = await askQuestion('Year (YYYY): ');
    const month = await askQuestion('Month (1-12): ');
    const day = await askQuestion('Day (1-31): ');
    const hour = await askQuestion('Hour (0-23): ');
    const minute = await askQuestion('Minute (0-59): ');

    try {
        const scheduledDate = new Date(
            parseInt(year),
            parseInt(month) - 1, // Month is 0-indexed
            parseInt(day),
            parseInt(hour),
            parseInt(minute)
        );

        if (scheduledDate <= new Date()) {
            return;
        }

        const repoData = {
            name: name.trim(),
            description: description.trim() || undefined,
            scheduledDate: scheduledDate.toISOString(),
            private: isPrivate,
            auto_init: autoInit,
            gitignore_template: gitignoreTemplate.trim() || null
        };

        const addedRepo = service.addScheduledRepo(repoData);

    } catch (error) {
    }
}

async function removeScheduledRepo() {
    service.listScheduledRepos();
    const repoId = await askQuestion('\nEnter repository ID to remove: ');
    
    if (repoId.trim()) {
        service.removeScheduledRepo(repoId.trim());
    } else {
    }
}

function showStats() {
    const stats = service.getStats();
}

async function main() {
    
    // Show current stats
    showStats();

    while (true) {
        showMenu();
        const choice = await askQuestion('Choose an option (1-6): ');

        switch (choice.trim()) {
            case '1':
                await setGithubToken();
                break;
            case '2':
                await addScheduledRepo();
                break;
            case '3':
                service.listScheduledRepos();
                break;
            case '4':
                await removeScheduledRepo();
                break;
            case '5':
                showStats();
                break;
            case '6':
                service.shutdown();
                rl.close();
                process.exit(0);
                break;
            default:
        }
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    service.shutdown();
    rl.close();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error(' Uncaught Exception:', error);
    service.shutdown();
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(' Unhandled Rejection at:', promise, 'reason:', reason);
    service.shutdown();
    process.exit(1);
});

// Start the CLI
main().catch((error) => {
    console.error(' Fatal error:', error);
    service.shutdown();
    process.exit(1);
});
