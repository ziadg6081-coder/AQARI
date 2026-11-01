const rateLimit = require("express-rate-limit");

// Login / Register
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many attempts. Please try again after 15 minutes."
    }
});

module.exports = { authLimiter };
