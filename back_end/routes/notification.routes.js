const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const message = require("../controllers/message.controller");

const router = express.Router();

router.get("/unread-count", authenticateToken, message.getUnreadCount);

module.exports = router;
