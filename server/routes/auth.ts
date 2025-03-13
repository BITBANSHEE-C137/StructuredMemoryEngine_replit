import express from 'express';
import { getUserInfo } from '@replit/repl-auth';

const router = express.Router();

// Route to handle login - redirects to Replit's Auth page
router.get('/login', (req, res) => {
  res.redirect('https://replit.com/auth_with_repl_site?domain=' + req.headers.host);
});

// Route to handle logout - clears the cookies
router.get('/logout', (req, res) => {
  res.clearCookie('REPL_AUTH');
  res.clearCookie('REPL_ID');
  res.redirect('/');
});

// Route to get current authenticated user info
router.get('/user', (req, res) => {
  const user = getUserInfo(req);
  
  if (user) {
    return res.json({ 
      authenticated: true, 
      user: {
        id: user.id || '',
        name: user.name || '',
        roles: user.roles || [],
        profileImage: user.profileImage || ''
      }
    });
  }
  
  return res.json({ authenticated: false, user: null });
});

export default router;