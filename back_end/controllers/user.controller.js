const db = require("../config/db");

// GET /api/users (admin only)
function getAllUsers(req, res) {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Only admins can view users" });
    }

    db.query("SELECT id, name, email, role FROM users", (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Failed to fetch users" });
        }

        res.json(results);
    });
}

// PUT /api/users/:id/role (admin only, roles: user / admin)
function updateUserRole(req, res) {
    const { id } = req.params;
    const { role } = req.body;

    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Only admins can update user roles"
        });
    }

    if (role !== "user" && role !== "admin") {
        return res.status(400).json({ message: "Role must be user or admin" });
    }

    if (Number(id) === Number(req.user.id)) {
        return res.status(400).json({
            message: "Admin cannot change their own role"
        });
    }

    db.query(
        "UPDATE users SET role = ? WHERE id = ?",
        [role, id],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    message: "Failed to update user role"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "User not found" });
            }

            res.json({ message: "User role updated successfully" });
        }
    );
}

// DELETE /api/users/:id (admin only)
function deleteUser(req, res) {
    const { id } = req.params;

    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Only admins can delete users"
        });
    }

    if (Number(id) === Number(req.user.id)) {
        return res.status(400).json({
            message: "Admin cannot delete their own account"
        });
    }

    db.query("DELETE FROM users WHERE id = ?", [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Failed to delete user" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "User deleted successfully" });
    });
}

module.exports = { getAllUsers, updateUserRole, deleteUser };
