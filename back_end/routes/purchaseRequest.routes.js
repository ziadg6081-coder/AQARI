const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const purchase = require("../controllers/purchaseRequest.controller");
const rating = require("../controllers/rating.controller");

const router = express.Router();

router.post("/", authenticateToken, purchase.createPurchaseRequest);
router.get("/my", authenticateToken, purchase.getMyPurchaseRequests);
router.get("/owner", authenticateToken, purchase.getOwnerPurchaseRequests);
router.put("/:id/approve", authenticateToken, purchase.approvePurchaseRequest);
router.put("/:id/reject", authenticateToken, purchase.rejectPurchaseRequest);
router.post("/:id/rate", authenticateToken, rating.rateOwner);

module.exports = router;
