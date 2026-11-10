const express = require('express');
const auth = require('../middleware/auth');
const {
  getSessions,
  createSession,
  sendMessage,
  getMessages,
  deleteSession,
} = require('../controllers/chatController');
const router = express.Router();

router.use(auth);
router.get('/sessions', getSessions);
router.post('/sessions', createSession);
router.post('/sessions/:sessionId/messages', sendMessage);
router.get('/sessions/:sessionId/messages', getMessages);
router.delete('/sessions/:sessionId', deleteSession);

module.exports = router;
