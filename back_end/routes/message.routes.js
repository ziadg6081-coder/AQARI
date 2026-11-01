const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const message = require("../controllers/message.controller");

const router = express.Router();

router.post("/", authenticateToken, message.sendMessage);
router.get("/conversations", authenticateToken, message.getConversations);
router.get("/with/:userId", authenticateToken, message.getMessagesWithUser);

module.exports = router;
