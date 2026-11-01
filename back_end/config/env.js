require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("Missing JWT_SECRET. Create a .env file first.");
    process.exit(1);
}

module.exports = {
    JWT_SECRET,
    PORT: process.env.PORT || 3000
};
