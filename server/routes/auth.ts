import express from 'express';
import { getUserInfo } from '@replit/repl-auth';

const router = express.Router();

// Route to handle login - redirects to Replit's Auth page
router.get('/login', (req, res) => {
  console.log('Auth login endpoint hit', {
    host: req.headers.host,
    referrer: req.headers.referer,
    url: req.url
  });
  
  // Build the redirect URL
  const redirectUrl = 'https://replit.com/auth_with_repl_site?domain=' + req.headers.host;
  console.log('Redirecting to:', redirectUrl);
  
  res.redirect(redirectUrl);
});

// Route to handle logout - clears the cookies
router.get('/logout', (req, res) => {
  console.log('Auth logout endpoint hit');
  res.clearCookie('REPL_AUTH');
  res.clearCookie('REPL_ID');
  res.redirect('/');
});

// Route to get current authenticated user info
router.get('/user', (req, res) => {
  console.log('Auth user endpoint hit', { 
    cookies: req.headers.cookie
  });
  
  const user = getUserInfo(req);
  console.log('User info from Replit Auth:', user ? 'Found user' : 'No user found');
  
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