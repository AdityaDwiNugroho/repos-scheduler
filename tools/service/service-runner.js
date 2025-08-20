const RepositorySchedulerService = require('./scheduler-service');

// Create and start the service
const service = new RepositorySchedulerService();


// Keep the service running
process.on('SIGTERM', () => {
    service.shutdown();
    process.exit(0);
});

process.on('SIGINT', () => {
    service.shutdown();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error(' Uncaught Exception in service:', error);
    service.shutdown();
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(' Unhandled Rejection in service:', promise, 'reason:', reason);
    service.shutdown();
    process.exit(1);
});

// Log startup message
