const db = require("../config/db");

// POST /api/purchase-requests
// User only (a user cannot buy their own property)
function createPurchaseRequest(req, res) {
    const { property_id } = req.body;

    if (!property_id) {
        return res.status(400).json({ message: "Property ID is required" });
    }

    if (req.user.role !== "user") {
        return res.status(403).json({
            message: "Only users can submit purchase requests"
        });
    }

    db.query(
        "SELECT * FROM properties WHERE id = ?",
        [property_id],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Database error" });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: "Property not found" });
            }

            if (Number(results[0].owner_id) === Number(req.user.id)) {
                return res.status(400).json({
                    message: "You cannot buy your own property"
                });
            }

            if (results[0].status === "sold") {
                return res.status(409).json({
                    message: "This property is no longer available"
                });
            }

            // Block a second pending request for the same property
            db.query(
                "SELECT id FROM purchase_requests WHERE user_id = ? AND property_id = ? AND status = 'pending'",
                [req.user.id, property_id],
                (err, existing) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ message: "Database error" });
                    }

                    if (existing.length > 0) {
                        return res.status(409).json({
                            message: "You already have a pending request for this property"
                        });
                    }

                    db.query(
                        "INSERT INTO purchase_requests (user_id, property_id) VALUES (?, ?)",
                        [req.user.id, property_id],
                        (err, result) => {
                            if (err) {
                                console.error(err);
                                return res.status(500).json({
                                    message: "Failed to create purchase request"
                                });
                            }

                            res.status(201).json({
                                message: "Purchase request created successfully",
                                request: {
                                    id: result.insertId,
                                    user_id: req.user.id,
                                    property_id: property_id,
                                    status: "pending"
                                }
                            });
                        }
                    );
                }
            );
        }
    );
}


// GET /api/purchase-requests/my
// User only (includes property details, owner_id, owner_name,
// owner_phone and my_rating: null until I rate the owner)
function getMyPurchaseRequests(req, res) {
    if (req.user.role !== "user") {
        return res.status(403).json({
            message: "Only users can view their purchase requests"
        });
    }

    db.query(
        "SELECT pr.*, p.title, p.location, p.price, p.owner_id, p.phone AS owner_phone, u.name AS owner_name, r.rating AS my_rating, r.comment AS my_rating_comment FROM purchase_requests pr LEFT JOIN properties p ON pr.property_id = p.id LEFT JOIN users u ON p.owner_id = u.id LEFT JOIN owner_ratings r ON r.purchase_request_id = pr.id WHERE pr.user_id = ? ORDER BY pr.id DESC",
        [req.user.id],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    message: "Failed to fetch purchase requests"
                });
            }

            res.json(results);
        }
    );
}


// GET /api/purchase-requests/owner
// Any logged-in user: requests on the properties they own
// Admin: requests on all properties
function getOwnerPurchaseRequests(req, res) {
    const baseSql =
        "SELECT pr.*, p.title, p.location, p.price, u.id AS buyer_id, u.name AS buyer_name, u.email AS buyer_email FROM purchase_requests pr JOIN properties p ON pr.property_id = p.id LEFT JOIN users u ON pr.user_id = u.id";

    const isAdmin = req.user.role === "admin";

    db.query(
        isAdmin
            ? baseSql + " ORDER BY pr.id DESC"
            : baseSql + " WHERE p.owner_id = ? ORDER BY pr.id DESC",
        isAdmin ? [] : [req.user.id],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    message: "Failed to fetch purchase requests"
                });
            }

            res.json(results);
        }
    );
}


// PUT /api/purchase-requests/:id/approve
// Property owner and Admin. In ONE transaction:
//   request -> approved
//   property -> sold
//   other pending requests on it -> rejected
async function approvePurchaseRequest(req, res) {
    let connection;

    try {
        connection = await db.promise().getConnection();

        await connection.beginTransaction();

        const [rows] = await connection.query(
            "SELECT pr.id, pr.property_id, pr.status, p.owner_id, p.status AS property_status FROM purchase_requests pr JOIN properties p ON pr.property_id = p.id WHERE pr.id = ? FOR UPDATE",
            [req.params.id]
        );

        const request = rows[0];

        if (
            !request ||
            (
                req.user.role !== "admin" &&
                Number(request.owner_id) !== Number(req.user.id)
            )
        ) {
            await connection.rollback();
            return res.status(404).json({
                message: "Purchase request not found or you are not the owner"
            });
        }

        if (request.status !== "pending") {
            await connection.rollback();
            return res.status(409).json({
                message: "This request has already been processed"
            });
        }

        if (request.property_status === "sold") {
            await connection.rollback();
            return res.status(409).json({
                message: "This property has already been sold"
            });
        }

        await connection.query(
            "UPDATE purchase_requests SET status = 'approved' WHERE id = ?",
            [request.id]
        );

        await connection.query(
            "UPDATE properties SET status = 'sold' WHERE id = ?",
            [request.property_id]
        );

        await connection.query(
            "UPDATE purchase_requests SET status = 'rejected' WHERE property_id = ? AND status = 'pending' AND id <> ?",
            [request.property_id, request.id]
        );

        await connection.commit();

        res.json({ message: "Purchase request approved successfully" });
    } catch (error) {
        console.error(error);

        if (connection) {
            await connection.rollback().catch(() => {});
        }

        res.status(500).json({
            message: "Failed to approve purchase request"
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}


// PUT /api/purchase-requests/:id/reject
// Property owner and Admin
function rejectPurchaseRequest(req, res) {
    const isAdmin = req.user.role === "admin";

    db.query(
        isAdmin
            ? "UPDATE purchase_requests SET status = ? WHERE id = ? AND status = 'pending'"
            : "UPDATE purchase_requests pr JOIN properties p ON pr.property_id = p.id SET pr.status = ? WHERE pr.id = ? AND p.owner_id = ? AND pr.status = 'pending'",
        isAdmin
            ? ["rejected", req.params.id]
            : ["rejected", req.params.id, req.user.id],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    message: "Failed to reject purchase request"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Purchase request not found or you are not the owner"
                });
            }

            res.json({ message: "Purchase request rejected successfully" });
        }
    );
}

module.exports = {
    createPurchaseRequest,
    getMyPurchaseRequests,
    getOwnerPurchaseRequests,
    approvePurchaseRequest,
    rejectPurchaseRequest
};
