const express = require('express');
const { authenticateToken, loadUsers } = require('./auth');
const { v4: uuidv4 } = require('uuid');

function createRepositoryRoutes(schedulerService) {
    const router = express.Router();

    // Get all scheduled repositories for the authenticated user
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const repositories = await schedulerService.getUserRepositories(req.user.userId);
            res.json({ repositories });
        } catch (error) {
            console.error('Error fetching repositories:', error);
            res.status(500).json({ error: 'Failed to fetch repositories' });
        }
    });

    // Add a new scheduled repository
    router.post('/', authenticateToken, async (req, res) => {
        try {
            const {
                name,
                description,
                scheduledDate,
                private: isPrivate,
                auto_init,
                gitignore_template
            } = req.body;

            // Validation
            if (!name || !scheduledDate) {
                return res.status(400).json({ error: 'Repository name and scheduled date are required' });
            }

            if (new Date(scheduledDate) <= new Date()) {
                return res.status(400).json({ error: 'Scheduled date must be in the future' });
            }

            // Check if user has GitHub token
            const users = await loadUsers();
            const user = users.find(u => u.id === req.user.userId);
            
            if (!user || !user.githubToken) {
                return res.status(400).json({ error: 'GitHub token not configured' });
            }

            // Create repository data
            const repoData = {
                id: uuidv4(),
                userId: req.user.userId,
                name: name.trim(),
                description: description?.trim() || '',
                scheduledDate: new Date(scheduledDate).toISOString(),
                private: isPrivate || false,
                auto_init: auto_init !== false,
                gitignore_template: gitignore_template || null,
                status: 'pending',
                createdAt: new Date().toISOString(),
                githubToken: user.githubToken
            };

            // Add to scheduler
            const addedRepo = await schedulerService.addRepository(repoData);


            res.status(201).json({
                message: 'Repository scheduled successfully',
                repository: {
                    id: addedRepo.id,
                    name: addedRepo.name,
                    description: addedRepo.description,
                    scheduledDate: addedRepo.scheduledDate,
                    private: addedRepo.private,
                    auto_init: addedRepo.auto_init,
                    gitignore_template: addedRepo.gitignore_template,
                    status: addedRepo.status,
                    createdAt: addedRepo.createdAt
                }
            });

        } catch (error) {
            console.error('Error scheduling repository:', error);
            res.status(500).json({ error: 'Failed to schedule repository' });
        }
    });

    // Get a specific repository
    router.get('/:id', authenticateToken, async (req, res) => {
        try {
            const repository = await schedulerService.getUserRepository(req.user.userId, req.params.id);
            
            if (!repository) {
                return res.status(404).json({ error: 'Repository not found' });
            }

            res.json({ repository });
        } catch (error) {
            console.error('Error fetching repository:', error);
            res.status(500).json({ error: 'Failed to fetch repository' });
        }
    });

    // Update a scheduled repository (only if still pending)
    router.put('/:id', authenticateToken, async (req, res) => {
        try {
            const {
                name,
                description,
                scheduledDate,
                private: isPrivate,
                auto_init,
                gitignore_template
            } = req.body;

            const repository = await schedulerService.getUserRepository(req.user.userId, req.params.id);
            
            if (!repository) {
                return res.status(404).json({ error: 'Repository not found' });
            }

            if (repository.status !== 'pending') {
                return res.status(400).json({ error: 'Can only update pending repositories' });
            }

            if (scheduledDate && new Date(scheduledDate) <= new Date()) {
                return res.status(400).json({ error: 'Scheduled date must be in the future' });
            }

            // Update repository
            const updateData = {};
            if (name) updateData.name = name.trim();
            if (description !== undefined) updateData.description = description.trim();
            if (scheduledDate) updateData.scheduledDate = new Date(scheduledDate).toISOString();
            if (isPrivate !== undefined) updateData.private = isPrivate;
            if (auto_init !== undefined) updateData.auto_init = auto_init;
            if (gitignore_template !== undefined) updateData.gitignore_template = gitignore_template;

            const updatedRepo = await schedulerService.updateRepository(req.params.id, updateData);


            res.json({
                message: 'Repository updated successfully',
                repository: updatedRepo
            });

        } catch (error) {
            console.error('Error updating repository:', error);
            res.status(500).json({ error: 'Failed to update repository' });
        }
    });

    // Delete a scheduled repository
    router.delete('/:id', authenticateToken, async (req, res) => {
        try {
            const repository = await schedulerService.getUserRepository(req.user.userId, req.params.id);
            
            if (!repository) {
                return res.status(404).json({ error: 'Repository not found' });
            }

            if (repository.status === 'creating') {
                return res.status(400).json({ error: 'Cannot delete repository that is currently being created' });
            }

            await schedulerService.removeRepository(req.params.id);


            res.json({ message: 'Repository deleted successfully' });

        } catch (error) {
            console.error('Error deleting repository:', error);
            res.status(500).json({ error: 'Failed to delete repository' });
        }
    });

    // Create repository immediately (bypass schedule)
    router.post('/:id/create-now', authenticateToken, async (req, res) => {
        try {
            const repository = await schedulerService.getUserRepository(req.user.userId, req.params.id);
            
            if (!repository) {
                return res.status(404).json({ error: 'Repository not found' });
            }

            if (repository.status !== 'pending') {
                return res.status(400).json({ error: 'Can only create pending repositories' });
            }

            // Trigger immediate creation
            await schedulerService.createRepositoryNow(req.params.id);


            res.json({ message: 'Repository creation started' });

        } catch (error) {
            console.error('Error creating repository now:', error);
            res.status(500).json({ error: 'Failed to create repository' });
        }
    });

    // Get repository statistics for the user
    router.get('/stats/summary', authenticateToken, async (req, res) => {
        try {
            const stats = await schedulerService.getUserStats(req.user.userId);
            res.json({ stats });
        } catch (error) {
            console.error('Error fetching user stats:', error);
            res.status(500).json({ error: 'Failed to fetch statistics' });
        }
    });

    return router;
}

module.exports = createRepositoryRoutes;
