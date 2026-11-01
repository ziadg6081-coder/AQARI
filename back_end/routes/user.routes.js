const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const user = require("../controllers/user.controller");
const rating = require("../controllers/rating.controller");

const router = express.Router();

// Public
router.get("/:id/ratings", rating.getOwnerRatings);

// Admin only (the role check is inside the controllers)
router.get("/", authenticateToken, user.getAllUsers);
router.put("/:id/role", authenticateToken, user.updateUserRole);
router.delete("/:id", authenticateToken, user.deleteUser);

module.exports = router;
