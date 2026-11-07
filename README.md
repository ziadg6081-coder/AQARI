# AQARI — Real Estate Platform

منصة عقارية متكاملة تتيح للمستخدمين استكشاف العقارات، ونشر عقاراتهم للبيع، وإدارة إعلاناتهم، والتواصل مع الملاك والمشترين من خلال نظام موحد.

## Project Overview

AQARI is a **Full-Stack Real Estate Platform** built using **HTML, CSS, Vanilla JavaScript** (Frontend) + **Node.js/Express.js** (Backend) + **MySQL** (Database).

The platform provides property listing management, advanced search and filtering, purchase requests, direct messaging, and user management.

## Main Features

- **User Authentication:** Registration, login, JWT authentication, and secure password hashing.
- **Property Listings:** Browse available properties and view detailed property information.
- **Property Management:** Create, edit, and delete property listings.
- **Image Uploads:** Upload and manage property images.
- **Advanced Search & Filtering:** Search properties by location, property type, price range, bedrooms, and bathrooms.
- **Purchase Requests:** Submit purchase requests and track their status.
- **Request Management:** Property owners can review, accept, or reject purchase requests.
- **Property Status:** Manage property availability (Available / Sold).
- **Messaging System:** Direct communication between users and property owners.
- **Notifications:** Track unread messages.
- **Ratings & Reviews:** Users can rate property owners after eligible transactions.
- **Admin Dashboard:** Manage users, roles, and platform activities.
- **Role-Based Access Control:** Different permissions for regular users, property owners, and administrators.

## Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Website Structure |
| CSS3 | Styling and Responsive Design |
| Vanilla JavaScript | Frontend Functionality |
| Node.js | Backend Runtime |
| Express.js | REST API |
| MySQL | Database Management |
| JWT | Authentication |
| bcryptjs | Password Hashing |
| Multer | Image Uploads |
| Postman | API Testing |
| Git & GitHub | Version Control |

## Local Setup

**Requirements:**
- Node.js
- MySQL Server
- npm

### Installation

1. Clone the repository:

```bash
git clone https://github.com/ziadg6081-coder/AQARI.git
```

2. Navigate to the project directory:

```bash
cd AQARI
```

3. Install backend dependencies:

```bash
cd back_end
npm install
```

4. Configure your database connection using the provided environment configuration.

5. Start the backend server using the start command configured in `package.json`.

6. Open the frontend through the configured local development server.

## Environment Configuration

Configure the backend environment variables before running the application.

Use `.env.example` as a reference if available.

**Important:** Never upload `.env` files, database passwords, JWT secrets, or other sensitive credentials to GitHub.

## Project Structure

```text
AQARI/
│
├── back_end/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── uploads/
│   ├── server.js
│   └── package.json
│
├── front_end/
│   ├── css/
│   ├── js/
│   ├── images/
│   └── index.html
│
├── .gitignore
└── README.md
```

## Future Improvements

- Online payment integration.
- Interactive maps and location-based property discovery.
- Advanced property recommendations.
- Improved user experience and performance.
- Mobile application integration.

## Author

**Ziad Gaber**

Full-Stack Developer

GitHub: [ziadg6081-coder](https://github.com/ziadg6081-coder)

Project: [AQARI](https://github.com/ziadg6081-coder/AQARI)
