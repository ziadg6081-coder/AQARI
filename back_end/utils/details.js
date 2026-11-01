const { DETAIL_FIELDS } = require("../config/constants");

// Returns { details } with only the fields that were sent,
// or { error } if one of them is invalid.
// An empty value clears the field (null).
function parseDetails(body) {
    const details = {};

    for (const field of DETAIL_FIELDS) {
        if (body[field] === undefined) {
            continue;
        }

        let value = body[field];

        if (value === "" || value === null) {
            details[field] = null;
            continue;
        }

        if (field === "description") {
            value = String(value).trim();

            if (value.length > 2000) {
                return { error: "Description must be 2000 characters or less" };
            }

            details[field] = value || null;
            continue;
        }

        const number = Number(value);

        if (!Number.isInteger(number) || number < 0) {
            return { error: `${field} must be a non-negative whole number` };
        }

        details[field] = number;
    }

    return { details: details };
}

module.exports = { parseDetails };
