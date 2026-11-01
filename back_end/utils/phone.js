// Egyptian mobile number
// Accepts 01xxxxxxxxx, +201xxxxxxxxx, 00201xxxxxxxxx
// Returns the number as 01xxxxxxxxx, or null if invalid
function normalizePhone(value) {
    const cleaned = String(value || "").replace(/[\s\-()]/g, "");

    const match = cleaned.match(/^(?:\+20|0020|0)?(1[0125]\d{8})$/);

    return match ? "0" + match[1] : null;
}

module.exports = { normalizePhone };
