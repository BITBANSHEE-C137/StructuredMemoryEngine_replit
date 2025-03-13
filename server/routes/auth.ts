import express from 'express';
import { loginUser, logoutUser } from '@replit/repl-auth';

const router = express.Router();

// Route to handle login
router.get('/login', (req, res) => {
  // The loginUser function will redirect the user to the Replit login page
  // and then redirect back to the provided redirect URL after successful login
  return loginUser(req, res, '/');
});

// Route to handle logout
router.get('/logout', (req, res) => {
  // The logoutUser function will log the user out and redirect to the provided URL
  return logoutUser(req, res, '/');
});

export default router;