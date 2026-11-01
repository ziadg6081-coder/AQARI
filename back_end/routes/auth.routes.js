const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const auth = require("../controllers/auth.controller");

const router = express.Router();

router.get("/protected", authenticateToken, auth.protectedTest);
router.get("/me", authenticateToken, auth.me);
router.post("/register", authLimiter, auth.register);
router.post("/login", authLimiter, auth.login);

module.exports = router;
