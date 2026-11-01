const db = require("../config/db");

// The property's owner (owner_id) and Admin (any property)
function loadOwnedProperty(req, res, next) {
    db.query(
        "SELECT * FROM properties WHERE id = ?",
        [req.params.id],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Database error" });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: "Property not found" });
            }

            const property = results[0];

            if (
                req.user.role !== "admin" &&
                Number(property.owner_id) !== Number(req.user.id)
            ) {
                return res.status(403).json({
                    message: "You are not the owner of this property"
                });
            }

            req.property = property;

            next();
        }
    );
}

module.exports = { loadOwnedProperty };
