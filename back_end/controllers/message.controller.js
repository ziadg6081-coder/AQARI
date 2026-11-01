const db = require("../config/db");
const { MAX_MESSAGE_LENGTH } = require("../config/constants");

const messagesDb = db.promise();


// POST /api/messages
// Body: { receiver_id, body, property_id? }
async function sendMessage(req, res) {
    const receiverId = Number(req.body.receiver_id);

    const body = String(req.body.body || "").trim();

    const propertyId =
        req.body.property_id === undefined ||
        req.body.property_id === null ||
        req.body.property_id === ""
            ? null
            : Number(req.body.property_id);

    if (!Number.isInteger(receiverId) || receiverId <= 0) {
        return res.status(400).json({
            message: "A valid receiver_id is required"
        });
    }

    if (receiverId === Number(req.user.id)) {
        return res.status(400).json({
            message: "You cannot send a message to yourself"
        });
    }

    if (!body) {
        return res.status(400).json({ message: "Message cannot be empty" });
    }

    if (body.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({
            message: `Message must be ${MAX_MESSAGE_LENGTH} characters or less`
        });
    }

    if (
        propertyId !== null &&
        (!Number.isInteger(propertyId) || propertyId <= 0)
    ) {
        return res.status(400).json({ message: "Invalid property_id" });
    }

    try {
        const [receivers] = await messagesDb.query(
            "SELECT id, name FROM users WHERE id = ?",
            [receiverId]
        );

        if (receivers.length === 0) {
            return res.status(404).json({ message: "Receiver not found" });
        }

        if (propertyId !== null) {
            const [properties] = await messagesDb.query(
                "SELECT id FROM properties WHERE id = ?",
                [propertyId]
            );

            if (properties.length === 0) {
                return res.status(404).json({ message: "Property not found" });
            }
        }

        const [senders] = await messagesDb.query(
            "SELECT name FROM users WHERE id = ?",
            [req.user.id]
        );

        const [result] = await messagesDb.query(
            "INSERT INTO messages (sender_id, receiver_id, property_id, body) VALUES (?, ?, ?, ?)",
            [req.user.id, receiverId, propertyId, body]
        );

        res.status(201).json({
            message: "Message sent successfully",
            data: {
                id: result.insertId,
                sender_id: req.user.id,
                sender_name: senders[0] ? senders[0].name : null,
                receiver_id: receiverId,
                receiver_name: receivers[0].name,
                property_id: propertyId,
                body: body
            }
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({ message: "Failed to send message" });
    }
}


// GET /api/messages/conversations
// One row per other user, with the last message, the property it was about
// (if any) and how many of their messages are still unread
async function getConversations(req, res) {
    try {
        const [conversations] = await messagesDb.query(
            `SELECT
                u.id AS user_id,
                u.name AS user_name,
                m.id AS last_message_id,
                m.sender_id AS last_sender_id,
                m.property_id AS last_property_id,
                p.title AS last_property_title,
                m.body AS last_message,
                m.created_at AS last_message_at
            FROM messages m
            JOIN (
                SELECT
                    IF(sender_id = ?, receiver_id, sender_id) AS other_id,
                    MAX(id) AS last_id
                FROM messages
                WHERE sender_id = ? OR receiver_id = ?
                GROUP BY other_id
            ) t ON m.id = t.last_id
            JOIN users u ON u.id = t.other_id
            LEFT JOIN properties p ON p.id = m.property_id
            ORDER BY m.id DESC`,
            [req.user.id, req.user.id, req.user.id]
        );

        const [unreadRows] = await messagesDb.query(
            "SELECT sender_id, COUNT(*) AS total FROM messages WHERE receiver_id = ? AND is_read = 0 GROUP BY sender_id",
            [req.user.id]
        );

        const unreadBySender = {};

        unreadRows.forEach((row) => {
            unreadBySender[row.sender_id] = row.total;
        });

        conversations.forEach((conversation) => {
            conversation.unread_count = unreadBySender[conversation.user_id] || 0;
        });

        res.json(conversations);
    } catch (error) {
        console.error(error);

        res.status(500).json({ message: "Failed to fetch conversations" });
    }
}


// GET /api/messages/with/:userId
// Optional ?after=<message id> to fetch only newer messages (polling)
// Returns { me, user, messages }
// Messages received from that user are marked as seen by the bell counter
async function getMessagesWithUser(req, res) {
    const otherId = Number(req.params.userId);

    const after = Number(req.query.after) || 0;

    if (!Number.isInteger(otherId) || otherId <= 0) {
        return res.status(400).json({ message: "Invalid user id" });
    }

    try {
        const [users] = await messagesDb.query(
            "SELECT id, name FROM users WHERE id = ?",
            [otherId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const [me] = await messagesDb.query(
            "SELECT id, name FROM users WHERE id = ?",
            [req.user.id]
        );

        const [messages] = await messagesDb.query(
            "SELECT m.id, m.sender_id, m.receiver_id, m.property_id, p.title AS property_title, m.body, m.created_at FROM messages m LEFT JOIN properties p ON p.id = m.property_id WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)) AND m.id > ? ORDER BY m.id ASC",
            [req.user.id, otherId, otherId, req.user.id, after]
        );

        await messagesDb.query(
            "UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0",
            [req.user.id, otherId]
        );

        res.json({
            me: me[0],
            user: users[0],
            messages: messages
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({ message: "Failed to fetch messages" });
    }
}


// GET /api/notifications/unread-count
// Number of new (unread) messages for the current user
async function getUnreadCount(req, res) {
    try {
        const [rows] = await messagesDb.query(
            "SELECT COUNT(*) AS total FROM messages WHERE receiver_id = ? AND is_read = 0",
            [req.user.id]
        );

        res.json({ count: rows[0].total });
    } catch (error) {
        console.error(error);

        res.status(500).json({ message: "Failed to fetch notifications" });
    }
}

module.exports = {
    sendMessage,
    getConversations,
    getMessagesWithUser,
    getUnreadCount
};
