const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
    name: 'Repository Scheduler Service',
    description: 'Automatically creates GitHub repositories at scheduled times',
    script: path.join(__dirname, 'service-runner.js')
});

// Listen for the "uninstall" event
svc.on('uninstall', function() {
});

svc.on('stop', function() {
});

svc.on('error', function(err) {
    console.error(' Service error:', err);
});

svc.uninstall();
