const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { JWT_SECRET } = require("../config/env");

// Verifies the token, then loads the CURRENT id / email / role
// from the database, so a role change or a deleted user takes effect immediately.
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Access denied. No token provided."
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({
                message: "Invalid or expired token"
            });
        }

        db.query(
            "SELECT id, email, role FROM users WHERE id = ?",
            [decoded.id],
            (dbErr, results) => {
                if (dbErr) {
                    console.error(dbErr);
                    return res.status(500).json({ message: "Database error" });
                }

                if (results.length === 0) {
                    return res.status(401).json({
                        message: "User no longer exists"
                    });
                }

                req.user = {
                    id: results[0].id,
                    email: results[0].email,
                    role: results[0].role
                };

                next();
            }
        );
    });
}

function requireRole(roles, message) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: message });
        }

        next();
    };
}

module.exports = { authenticateToken, requireRole };
