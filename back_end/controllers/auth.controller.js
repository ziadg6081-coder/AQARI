const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { JWT_SECRET } = require("../config/env");

// GET /api/protected
function protectedTest(req, res) {
    res.json({
        message: "You accessed a protected route!",
        user: req.user
    });
}

// GET /api/me
// Returns the role as it is NOW in the database
function me(req, res) {
    db.query(
        "SELECT id, name, email, role FROM users WHERE id = ?",
        [req.user.id],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Failed to fetch user" });
            }

            if (results.length === 0) {
                return res.status(401).json({ message: "User no longer exists" });
            }

            res.json(results[0]);
        }
    );
}

// POST /api/register
async function register(req, res) {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            message: "Name, email and password are required"
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            message: "Password must be at least 6 characters"
        });
    }

    try {
        db.query(
            "SELECT * FROM users WHERE email = ?",
            [email],
            async (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ message: "Database error" });
                }

                if (results.length > 0) {
                    return res.status(409).json({
                        message: "Email already registered"
                    });
                }

                const hashedPassword = await bcrypt.hash(password, 10);

                // New users are always registered as "user"
                db.query(
                    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
                    [name, email, hashedPassword, "user"],
                    (err, result) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).json({
                                message: "Failed to register user"
                            });
                        }

                        res.status(201).json({
                            message: "User registered successfully",
                            user: {
                                id: result.insertId,
                                name: name,
                                email: email,
                                role: "user"
                            }
                        });
                    }
                );
            }
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
}

// POST /api/login
function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }

    db.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        async (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Database error" });
            }

            if (results.length === 0) {
                return res.status(401).json({
                    message: "Invalid email or password"
                });
            }

            const user = results[0];

            const passwordMatch = await bcrypt.compare(password, user.password);

            if (!passwordMatch) {
                return res.status(401).json({
                    message: "Invalid email or password"
                });
            }

            const token = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    role: user.role
                },
                JWT_SECRET,
                { expiresIn: "1h" }
            );

            res.json({
                message: "Login successful",
                token: token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        }
    );
}

module.exports = { protectedTest, me, register, login };
