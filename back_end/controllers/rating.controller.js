const db = require("../config/db");

// POST /api/purchase-requests/:id/rate
// The buyer of an APPROVED purchase request rates the property's owner.
// One rating per purchase request. Body: { rating: 1-5, comment? }
async function rateOwner(req, res) {
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({
            message: "Rating must be a whole number from 1 to 5"
        });
    }

    if (comment.length > 500) {
        return res.status(400).json({
            message: "Comment must be 500 characters or less"
        });
    }

    try {
        const [rows] = await db.promise().query(
            "SELECT pr.id, pr.user_id, pr.status, p.owner_id FROM purchase_requests pr JOIN properties p ON pr.property_id = p.id WHERE pr.id = ?",
            [req.params.id]
        );

        const request = rows[0];

        if (!request || Number(request.user_id) !== Number(req.user.id)) {
            return res.status(404).json({
                message: "Purchase request not found"
            });
        }

        if (request.status !== "approved") {
            return res.status(400).json({
                message: "You can rate the owner only after the purchase is approved"
            });
        }

        if (!request.owner_id) {
            return res.status(400).json({
                message: "This property has no owner to rate"
            });
        }

        await db.promise().query(
            "INSERT INTO owner_ratings (purchase_request_id, owner_id, buyer_id, rating, comment) VALUES (?, ?, ?, ?, ?)",
            [request.id, request.owner_id, req.user.id, rating, comment || null]
        );

        res.status(201).json({
            message: "Thank you! Your rating was submitted"
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "You already rated this purchase"
            });
        }

        console.error(error);

        res.status(500).json({ message: "Failed to submit rating" });
    }
}


// GET /api/users/:id/ratings (public)
// Returns { owner, average, count, ratings: [...] }
async function getOwnerRatings(req, res) {
    try {
        const [users] = await db.promise().query(
            "SELECT id, name FROM users WHERE id = ?",
            [req.params.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const [summary] = await db.promise().query(
            "SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS average FROM owner_ratings WHERE owner_id = ?",
            [req.params.id]
        );

        const [ratings] = await db.promise().query(
            "SELECT r.id, r.rating, r.comment, r.created_at, u.name AS buyer_name FROM owner_ratings r LEFT JOIN users u ON u.id = r.buyer_id WHERE r.owner_id = ? ORDER BY r.id DESC LIMIT 50",
            [req.params.id]
        );

        res.json({
            owner: users[0],
            average:
                summary[0].average === null
                    ? null
                    : Number(summary[0].average),
            count: summary[0].count,
            ratings: ratings
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({ message: "Failed to fetch ratings" });
    }
}

module.exports = { rateOwner, getOwnerRatings };
