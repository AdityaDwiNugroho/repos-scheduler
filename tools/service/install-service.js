const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
    name: 'Repository Scheduler Service',
    description: 'Automatically creates GitHub repositories at scheduled times',
    script: path.join(__dirname, 'service-runner.js'),
    nodeOptions: [
        '--harmony',
        '--max_old_space_size=4096'
    ]
});

// Listen for the "install" event, which indicates the process is available as a service.
svc.on('install', function() {
    svc.start();
});

svc.on('alreadyinstalled', function() {
});

svc.on('start', function() {
});

svc.on('error', function(err) {
    console.error(' Service error:', err);
});

svc.install();
