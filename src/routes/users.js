const express = require('express');
const { User } = require('../models');
const ProducerService = require('../services/producer');
const router = express.Router();

/**
 * Create a new user and publish event
 */
router.post('/', async (req, res) => {
  try {
    const { username, email } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        error: 'Username and email are required'
      });
    }

    // Create user in database
    const user = await User.create({
      username,
      email,
      status: 'active'
    });

    // Publish user created event
    const messageId = await ProducerService.publishUserCreated(user);

    res.status(201).json({
      success: true,
      user,
      messageId,
      message: 'User created and event published successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      error: 'Failed to create user',
      details: error.message
    });
  }
});

/**
 * Update a user and publish event
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Track changes
    const changes = {};
    Object.keys(updates).forEach(key => {
      if (user[key] !== updates[key]) {
        changes[key] = {
          from: user[key],
          to: updates[key]
        };
      }
    });

    // Update user
    await user.update(updates);

    // Publish user updated event
    const messageId = await ProducerService.publishUserUpdated(user, changes);

    res.json({
      success: true,
      user,
      changes,
      messageId,
      message: 'User updated and event published successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      error: 'Failed to update user',
      details: error.message
    });
  }
});

/**
 * Delete a user and publish event
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const username = user.username;
    const userId = user.id;

    // Delete user
    await user.destroy();

    // Publish user deleted event
    const messageId = await ProducerService.publishUserDeleted(userId, username);

    res.json({
      success: true,
      messageId,
      message: 'User deleted and event published successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      error: 'Failed to delete user',
      details: error.message
    });
  }
});

/**
 * Get all users
 */
router.get('/', async (req, res) => {
  try {
    const users = await User.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      users,
      count: users.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      details: error.message
    });
  }
});

/**
 * Get user by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      error: 'Failed to fetch user',
      details: error.message
    });
  }
});

/**
 * Get user events
 */
router.get('/:id/events', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const events = await Event.findAndCountAll({
      where: { userId: id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      events: events.rows,
      total: events.count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching user events:', error);
    res.status(500).json({
      error: 'Failed to fetch user events',
      details: error.message
    });
  }
});

module.exports = router;
