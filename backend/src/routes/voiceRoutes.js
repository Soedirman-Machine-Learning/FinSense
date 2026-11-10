const express = require('express');
// const auth = require('../middleware/auth');
const router = express.Router();
const voiceController = require('../controllers/voiceController');

const os = require('os');
const multer = require('multer');

// Rekaman ditaruh di direktori sementara sistem, bukan di 'uploads/' relatif.
// Di Vercel seluruh filesystem proyek read-only dan hanya /tmp yang boleh
// ditulisi, jadi path relatif membuat setiap unggahan suara gagal. os.tmpdir()
// menunjuk /tmp di sana dan tetap bekerja di laptop.
const upload = multer({ dest: os.tmpdir() });

router.post('/voice', upload.single('audio'), voiceController.processVoice);

module.exports = router;
