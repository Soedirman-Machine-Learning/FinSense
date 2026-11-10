const express = require('express');
const auth = require('../middleware/auth');
const aiPrediction = require('../controllers/aiPredictionController');
const router = express.Router();

router.use(auth);
router.get('/predict-revenue', aiPrediction.predictRevenue);
router.get('/predict-top-products', aiPrediction.predictTopProducts);
router.get('/predict-stock/:productId', aiPrediction.predictStock);
router.post('/predict-stock/:productId', aiPrediction.predictStock);
router.get('/real-top-products', aiPrediction.getRealTopProducts);

module.exports = router;
