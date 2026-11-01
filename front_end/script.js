console.log("SCRIPT IS WORKING");

const API = "http://localhost:3000";


// =========================
// HELPERS (ESCAPE / JWT / CURRENT USER)
// =========================

// Fresh user data from /api/me (kept in memory only, never trusted from storage)
let liveUser = null;


function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


function parseJwt(token) {
    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = decodeURIComponent(
            atob(base64)
                .split("")
                .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        return JSON.parse(json);
    } catch (error) {
        return null;
    }
}


function isTokenExpired(token) {
    const payload = parseJwt(token);
    if (!payload || !payload.exp) {
        return true;
    }
    return payload.exp * 1000 < Date.now();
}


// Current user = id / email / role from the JWT,
// but the role and name are replaced by the fresh values from /api/me
// as soon as they arrive (so a role change shows up without a new login).

function getCurrentUser() {

    const token = localStorage.getItem("zizo_token");

    if (!token) {
        return null;
    }

    const payload = parseJwt(token);

    if (!payload || isTokenExpired(token)) {
        return null;
    }

    let stored = {};

    try {
        stored = JSON.parse(localStorage.getItem("zizo_user")) || {};
    } catch (error) {
        stored = {};
    }

    const live =
        liveUser && Number(liveUser.id) === Number(payload.id)
            ? liveUser
            : null;

    return {
        id: payload.id,
        email: payload.email,
        role: live ? live.role : payload.role,
        name: live ? live.name : (stored.name || payload.email)
    };
}


function getCurrentRole() {
    const user = getCurrentUser();
    return user ? user.role : null;
}


// =========================
// GOVERNORATES (EGYPT - 27)
// Loaded from the backend, with the same list as a fallback
// =========================

const GOVERNORATES_FALLBACK = [
    "Cairo", "Giza", "Alexandria", "Qalyubia", "Port Said", "Suez",
    "Dakahlia", "Sharqia", "Gharbia", "Monufia", "Beheira", "Kafr El Sheikh",
    "Damietta", "Ismailia", "Faiyum", "Beni Suef", "Minya", "Asyut",
    "Sohag", "Qena", "Luxor", "Aswan", "Red Sea", "New Valley",
    "Matrouh", "North Sinai", "South Sinai"
];

let governorates = GOVERNORATES_FALLBACK.slice();


// Fills a <select> with the governorates (keeps the first placeholder option)

function fillGovernorateSelect(select, selectedValue) {

    if (!select) {
        return;
    }

    const current =
        selectedValue !== undefined
            ? selectedValue
            : select.value;

    // keep only the first (placeholder) option
    while (select.options.length > 1) {
        select.remove(1);
    }

    governorates.forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });

    select.value = current || "";
}


function fillAllGovernorateSelects() {
    fillGovernorateSelect(document.getElementById("filter-governorate"));
    fillGovernorateSelect(document.getElementById("property-governorate"));
}


function loadGovernorates() {

    // The fallback list is shown immediately
    fillAllGovernorateSelects();

    return fetch(`${API}/api/governorates`)
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to fetch governorates");
            }
            return response.json();
        })
        .then(list => {
            if (Array.isArray(list) && list.length > 0) {
                governorates = list;
                fillAllGovernorateSelects();
            }
        })
        .catch(error => {
            console.error("Governorates Error:", error);
        });
}


// =========================
// PROPERTY TYPES + RATING HELPERS
// =========================

let propertyTypes = [];


function typeLabel(value) {
    const t = propertyTypes.find(x => x.value === value);
    return t ? t.label : "";
}


function fillTypeSelect(select, selectedValue) {

    if (!select) {
        return;
    }

    const current =
        selectedValue !== undefined
            ? selectedValue
            : select.value;

    while (select.options.length > 1) {
        select.remove(1);
    }

    propertyTypes.forEach(t => {
        const option = document.createElement("option");
        option.value = t.value;
        option.textContent = t.label;
        select.appendChild(option);
    });

    select.value = current || "";
}


function loadPropertyTypes() {

    return fetch(`${API}/api/property-types`)
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to fetch property types");
            }
            return response.json();
        })
        .then(list => {
            if (Array.isArray(list)) {
                propertyTypes = list;
                fillTypeSelect(document.getElementById("filter-type"));
                fillTypeSelect(document.getElementById("property-type"));
                // Re-render so the type chips show up
                renderProperties();
            }
        })
        .catch(error => {
            console.error("Property Types Error:", error);
        });
}


function ratingHTML(ownerId, rating, count) {

    if (!ownerId) {
        return "";
    }

    if (!count) {
        return '<span class="owner-rating muted">No ratings yet</span>';
    }

    return `<span class="owner-rating" onclick="showOwnerRatings(${Number(ownerId)})">★ ${escapeHTML(rating)} (${escapeHTML(count)})</span>`;
}


function showOwnerRatings(ownerId) {

    fetch(`${API}/api/users/${ownerId}/ratings`)

        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to fetch ratings");
            }
            return response.json();
        })

        .then(data => {

            document.getElementById("ratings-title").textContent =
                `Ratings: ${data.owner.name}`;

            document.getElementById("ratings-summary").textContent =
                data.count > 0
                    ? `★ ${data.average} from ${data.count} rating(s)`
                    : "No ratings yet.";

            document.getElementById("ratings-list").innerHTML =
                data.ratings.map(r => `

                    <div class="rating-item">

                        <strong>${escapeHTML(r.buyer_name || "User")}</strong>

                        <span class="owner-rating">★ ${escapeHTML(r.rating)}</span>

                        ${r.comment ? `<p>${escapeHTML(r.comment)}</p>` : ""}

                    </div>

                `).join("");

            document.getElementById("ratings-modal").style.display = "flex";

        })

        .catch(error => {
            console.error("Ratings Error:", error);
        });
}


function closeRatingsModal() {
    document.getElementById("ratings-modal").style.display = "none";
}


// Buyer rates the owner after an APPROVED purchase request

function rateOwner(requestId) {

    const input = prompt("Rate the owner from 1 to 5:");

    if (input === null) {
        return;
    }

    const rating = Number(input);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        alert("Rating must be a whole number from 1 to 5.");
        return;
    }

    const comment = prompt("Add a comment (optional):") || "";

    apiRequest(`${API}/api/purchase-requests/${requestId}/rate`, {
        method: "POST",
        body: JSON.stringify({ rating: rating, comment: comment })
    })
        .then(result => {
            alert(result.message || "Rating submitted!");
            loadMyRequests();
            loadProperties();
        })
        .catch(error => {
            console.error("Rate Owner Error:", error);
            alert(error.message);
        });
}


// =========================
// AUTHENTICATION
// =========================

function showLoginForm() {
    document.getElementById("register-form").style.display = "none";
    document.getElementById("login-form").style.display = "flex";
}


function showRegisterForm() {
    document.getElementById("login-form").style.display = "none";
    document.getElementById("register-form").style.display = "flex";
}


function closeAuthForms() {
    document.getElementById("login-form").style.display = "none";
    document.getElementById("register-form").style.display = "none";
}


// =========================
// REGISTER USER
// =========================

function registerUser() {

    const name = document.getElementById("register-name").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;

    if (name === "" || email === "" || password === "") {
        alert("Please fill in all fields.");
        return;
    }

    fetch(`${API}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, email: email, password: password })
    })
        .then(response => response.json())
        .then(result => {

            console.log("Register response:", result);

            if (result.user) {

                alert("Registration successful! Please login.");

                document.getElementById("register-name").value = "";
                document.getElementById("register-email").value = "";
                document.getElementById("register-password").value = "";

                showLoginForm();

            } else {
                alert(result.message || "Registration failed.");
            }

        })
        .catch(error => {
            console.error("Register Error:", error);
            alert("Something went wrong during registration.");
        });
}


// =========================
// LOGIN USER
// =========================

function loginUser() {

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    if (email === "" || password === "") {
        alert("Please enter your email and password.");
        return;
    }

    fetch(`${API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password })
    })
        .then(response => response.json())
        .then(result => {

            console.log("Login response:", result);

            if (!result.token) {
                alert(result.message || "Login failed.");
                return;
            }

            localStorage.setItem("zizo_token", result.token);
            localStorage.setItem("zizo_user", JSON.stringify(result.user));

            liveUser = null;

            alert("Login successful!");

            closeAuthForms();

            updateNavbar();

            // Re-render the cards so the buttons match the new user
            loadProperties();

        })
        .catch(error => {
            console.error("Login Error:", error);
            alert("Something went wrong during login.");
        });
}


// =========================
// LOGOUT
// =========================

function logoutUser() {

    localStorage.removeItem("zizo_token");
    localStorage.removeItem("zizo_user");

    liveUser = null;

    updateNavbar();

    // Re-render the cards as a guest
    loadProperties();

    alert("You have been logged out.");
}


// =========================
// SESSION EXPIRED (401 / invalid token)
// =========================

function handleSessionExpired() {

    localStorage.removeItem("zizo_token");
    localStorage.removeItem("zizo_user");

    liveUser = null;

    updateNavbar();

    loadProperties();

    showLoginForm();
}


// =========================
// REFRESH CURRENT USER (/api/me)
// Picks up role changes made by an admin without a new login
// =========================

function refreshCurrentUser() {

    if (!getAuthToken()) {
        liveUser = null;
        return Promise.resolve();
    }

    return apiRequest(`${API}/api/me`)
        .then(me => {

            const roleBefore = getCurrentRole();

            liveUser = me;

            localStorage.setItem("zizo_user", JSON.stringify(me));

            if (roleBefore !== me.role) {
                updateNavbar();
                loadProperties();
            }

        })
        .catch(error => {
            console.error("Refresh User Error:", error);
        });
}


// =========================
// UPDATE NAVBAR
// =========================

function updateNavbar() {

    const authSection = document.querySelector(".auth-section");

    const token = localStorage.getItem("zizo_token");

    if (!authSection) {
        return;
    }

    // Token exists but is expired -> clean it silently
    if (token && isTokenExpired(token)) {
        localStorage.removeItem("zizo_token");
        localStorage.removeItem("zizo_user");
        liveUser = null;
    }

    const user = getCurrentUser();

    if (user) {

        authSection.innerHTML = `

            <span class="welcome-user">
                Welcome, ${escapeHTML(user.name)}
            </span>

            <span class="role-badge role-${escapeHTML(user.role)}">
                ${escapeHTML(user.role)}
            </span>

            <button class="logout-btn" onclick="logoutUser()">Logout</button>

        `;

    } else {

        authSection.innerHTML = `

            <button class="login-btn" onclick="showLoginForm()">Login</button>

            <button class="register-btn" onclick="showRegisterForm()">Register</button>

        `;
    }

    applyRoleUI();
}


// =========================
// GET AUTH TOKEN
// =========================

function getAuthToken() {
    return localStorage.getItem("zizo_token");
}


// =========================
// API REQUEST (WITH TOKEN + 401 / 403 HANDLING)
// Works with JSON bodies and with FormData (image upload)
// =========================

function apiRequest(url, options = {}) {

    const token = getAuthToken();

    if (!token) {
        showLoginForm();
        return Promise.reject(new Error("Please login first."));
    }

    if (isTokenExpired(token)) {
        handleSessionExpired();
        return Promise.reject(new Error("Your session has expired. Please login again."));
    }

    const headers = {
        "Authorization": `Bearer ${token}`
    };

    // For FormData the browser sets the Content-Type (with the boundary) itself
    if (options.body && !(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    return fetch(url, {
        method: options.method || "GET",
        headers: headers,
        body: options.body
    })

        .then(response => {
            return response
                .json()
                .catch(() => ({}))
                .then(data => ({ response: response, data: data }));
        })

        .then(({ response, data }) => {

            // 401 = no token / user no longer exists
            if (response.status === 401) {

                handleSessionExpired();

                throw new Error(
                    data.message === "User no longer exists"
                        ? "Your account no longer exists."
                        : "Please login first."
                );
            }

            // 403 = invalid/expired token OR no permission
            if (response.status === 403) {

                if (data.message === "Invalid or expired token") {
                    handleSessionExpired();
                    throw new Error("Your session has expired. Please login again.");
                }

                throw new Error(data.message || "You do not have permission to do this.");
            }

            if (!response.ok) {
                throw new Error(data.message || "Something went wrong.");
            }

            return data;

        });
}


// =========================
// ROLE PERMISSIONS (UI)
// Roles are only "user" and "admin".
// A user manages the properties he owns, an admin manages all of them.
// =========================

function canManageProperty(property) {

    const user = getCurrentUser();

    if (!user) {
        return false;
    }

    if (user.role === "admin") {
        return true;
    }

    return (
        property.owner_id !== null &&
        property.owner_id !== undefined &&
        Number(property.owner_id) === Number(user.id)
    );
}


// =========================
// APPLY ROLE UI
// =========================

function setDisplay(id, show, displayValue) {

    const element = document.getElementById(id);

    if (!element) {
        return;
    }

    element.style.display = show ? (displayValue || "block") : "none";
}


function applyRoleUI() {

    const user = getCurrentUser();
    const role = user ? user.role : null;
    const isLoggedIn = !!user;
    const isUser = role === "user";
    const isAdmin = role === "admin";

    // Add Property (any logged-in user)
    setDisplay("add-property-button", isLoggedIn, "inline-block");

    if (!isLoggedIn) {
        setDisplay("add-property-form", false);
    }

    // All / My Properties filter (any logged-in user)
    setDisplay("properties-filter", isLoggedIn, "flex");

    if (!isLoggedIn) {
        propertiesFilter = "all";
        updateFilterButtons();
    }

    // Navbar links
    setDisplay("nav-my-requests", isUser, "inline");
    setDisplay("nav-my-properties", isLoggedIn, "inline");
    setDisplay("nav-owner-requests", isLoggedIn, "inline");
    setDisplay("nav-messages", isLoggedIn, "inline");
    setDisplay("nav-users", isAdmin, "inline");

    // Dashboard sections
    setDisplay("my-requests-section", isUser, "block");
    setDisplay("owner-requests-section", isLoggedIn, "block");
    setDisplay("users-section", isAdmin, "block");

    const ownerTitle = document.getElementById("owner-requests-title");

    if (ownerTitle) {
        ownerTitle.textContent =
            isAdmin
                ? "All Purchase Requests"
                : "Purchase Requests For My Properties";
    }

    // Notification bell + chat polling
    setDisplay("notification-bell", isLoggedIn, "flex");

    if (isLoggedIn) {
        startBellPolling();
    } else {
        stopBellPolling();
        setBellCount(0);
        closeChat();
    }

    // Load the data of the current user
    if (isUser) {
        loadMyRequests();
    } else {
        myRequestsCache = [];
    }

    if (isLoggedIn) {
        loadOwnerRequests();
    } else {
        ownerRequestsCache = [];
    }

    if (isAdmin) {
        loadUsers();
    } else {
        usersCache = [];
    }
}


// =========================
// PROPERTY IMAGES
// =========================

const propertyImages = [
    "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=85"
];


// placeholder used when a property has no uploaded images
function getPropertyImage(index) {
    return propertyImages[index % propertyImages.length];
}


// =========================
// IMAGE FILES VALIDATION (upload)
// Same limits as the backend: 5 files, JPG/PNG/WEBP, 5MB each
// =========================

const MAX_UPLOAD_IMAGES = 5;

const MAX_UPLOAD_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];


// Returns an error message, or "" if everything is fine
function validateImageFiles(files) {

    if (files.length > MAX_UPLOAD_IMAGES) {
        return `You can select up to ${MAX_UPLOAD_IMAGES} images at once.`;
    }

    for (const file of files) {

        if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
            return `"${file.name}" is not a JPG, PNG or WEBP image.`;
        }

        if (file.size > MAX_UPLOAD_IMAGE_SIZE) {
            return `"${file.name}" is larger than 5MB.`;
        }
    }

    return "";
}


// =========================
// PREVIEW SELECTED IMAGES (add property form)
// =========================

function previewSelectedImages(input) {

    const preview = document.getElementById("property-images-preview");

    if (!preview) {
        return;
    }

    preview.querySelectorAll("img").forEach(img => {
        URL.revokeObjectURL(img.src);
    });

    preview.innerHTML = "";

    const files = Array.from(input.files);

    const error = validateImageFiles(files);

    if (error) {
        alert(error);
        input.value = "";
        return;
    }

    files.forEach(file => {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        img.className = "preview-thumb";
        preview.appendChild(img);
    });
}


// =========================
// STATE (CACHES)
// =========================

let propertiesCache = [];

let propertiesFilter = "all";

let myRequestsCache = [];

let ownerRequestsCache = [];

let usersCache = [];

// Active filters sent to GET /api/properties (only the ones that have a value)
let currentFilters = {};


// =========================
// FILTERS (governorate / type / price / bedrooms / bathrooms)
// =========================

function buildFilterQuery() {

    const params = new URLSearchParams();

    Object.keys(currentFilters).forEach(key => {
        if (currentFilters[key] !== "") {
            params.append(key, currentFilters[key]);
        }
    });

    return params.toString();
}


function hasActiveFilters() {
    return Object.keys(currentFilters).some(key => currentFilters[key] !== "");
}


function applyFilters() {

    const governorate = document.getElementById("filter-governorate").value;
    const type = document.getElementById("filter-type").value;
    const minPrice = document.getElementById("filter-min-price").value.trim();
    const maxPrice = document.getElementById("filter-max-price").value.trim();
    const bedrooms = document.getElementById("filter-bedrooms").value;
    const bathrooms = document.getElementById("filter-bathrooms").value;

    if (minPrice !== "" && (isNaN(Number(minPrice)) || Number(minPrice) < 0)) {
        alert("Min price must be a positive number.");
        return;
    }

    if (maxPrice !== "" && (isNaN(Number(maxPrice)) || Number(maxPrice) < 0)) {
        alert("Max price must be a positive number.");
        return;
    }

    if (minPrice !== "" && maxPrice !== "" && Number(minPrice) > Number(maxPrice)) {
        alert("Min price cannot be greater than max price.");
        return;
    }

    currentFilters = {
        governorate: governorate,
        type: type,
        min_price: minPrice,
        max_price: maxPrice,
        bedrooms: bedrooms,
        bathrooms: bathrooms
    };

    loadProperties();
}


function resetFilters() {

    document.getElementById("filter-governorate").value = "";
    document.getElementById("filter-type").value = "";
    document.getElementById("filter-min-price").value = "";
    document.getElementById("filter-max-price").value = "";
    document.getElementById("filter-bedrooms").value = "";
    document.getElementById("filter-bathrooms").value = "";

    currentFilters = {};

    loadProperties();
}


// =========================
// GET ALL PROPERTIES (with the active filters)
// =========================

function loadProperties() {

    const query = buildFilterQuery();

    return fetch(`${API}/api/properties` + (query ? "?" + query : ""))

        .then(response => {

            console.log("Response received:", response.status);

            if (!response.ok) {
                return response
                    .json()
                    .catch(() => ({}))
                    .then(data => {
                        throw new Error(data.message || "Failed to fetch properties");
                    });
            }

            return response.json();

        })

        .then(properties => {

            console.log("Properties:", properties);

            propertiesCache = properties;

            renderProperties();

            // Requests show the property title from this cache
            if (getCurrentRole() === "user") {
                renderMyRequests();
            }

            if (getCurrentUser()) {
                renderOwnerRequests();
            }

        })

        .catch(error => {
            console.error("Error:", error);
        });
}


// =========================
// RENDER PROPERTIES
// =========================

function renderProperties() {

    const container = document.getElementById("properties-container");

    container.innerHTML = "";

    const currentUser = getCurrentUser();

    const showMineOnly =
        propertiesFilter === "mine" &&
        !!currentUser;

    let shown = 0;

    propertiesCache.forEach((property, index) => {

        // "My Properties" filter (by owner_id)
        if (
            showMineOnly &&
            Number(property.owner_id) !== Number(currentUser.id)
        ) {
            return;
        }

        shown++;

        const card = document.createElement("div");

        card.dataset.propertyId = property.id;

        // First uploaded image, or the placeholder
        const propertyImage =
            property.images && property.images.length > 0
                ? property.images[0].url
                : getPropertyImage(index);

        const isSold = property.status === "sold";

        const canManage = canManageProperty(property);

        const isMine =
            !!currentUser &&
            property.owner_id !== null &&
            property.owner_id !== undefined &&
            Number(property.owner_id) === Number(currentUser.id);

        // Guests get asked to login, admins cannot buy
        const canRequest =
            (!currentUser || currentUser.role === "user") &&
            !isSold &&
            !isMine;

        // Chat with the owner of the property (not with yourself)
        const canMessage =
            !isMine &&
            property.owner_id !== null &&
            property.owner_id !== undefined;

        let actionsHTML = `

            <button onclick="viewProperty(${property.id})">View Details</button>

        `;

        if (canMessage) {
            actionsHTML += `

                <button onclick="messageOwner(${property.id})">Message Owner</button>

            `;
        }

        if (canRequest) {
            actionsHTML += `

                <button onclick="requestToBuy(${property.id})">Request to Buy</button>

            `;
        }

        if (canManage) {
            actionsHTML += `

                <button data-action="edit" onclick="editProperty(${property.id}, this)">Edit</button>

                <button onclick="deleteProperty(${property.id})">Delete</button>

                <button onclick="togglePropertyStatus(${property.id}, '${isSold ? "available" : "sold"}')">
                    ${isSold ? "Mark as Available" : "Mark as Sold"}
                </button>

            `;
        }

        // Type / bedrooms / bathrooms / area (only the ones that exist)
        const metaParts = [];

        if (property.property_type && typeLabel(property.property_type)) {
            metaParts.push(
                `<span class="detail-chip">${escapeHTML(typeLabel(property.property_type))}</span>`
            );
        }

        if (property.bedrooms !== null && property.bedrooms !== undefined) {
            metaParts.push(
                `<span class="detail-chip">${escapeHTML(property.bedrooms)} Beds</span>`
            );
        }

        if (property.bathrooms !== null && property.bathrooms !== undefined) {
            metaParts.push(
                `<span class="detail-chip">${escapeHTML(property.bathrooms)} Baths</span>`
            );
        }

        if (property.area !== null && property.area !== undefined) {
            metaParts.push(
                `<span class="detail-chip">${escapeHTML(property.area)} m²</span>`
            );
        }

        // Governorate + detailed location
        const locationText =
            property.governorate
                ? `${property.governorate} - ${property.location}`
                : property.location;

        card.innerHTML = `

            <div class="property-image">

                <img src="${escapeHTML(propertyImage)}" alt="${escapeHTML(property.title)}">

                ${isSold ? '<span class="sold-ribbon">Sold</span>' : ''}

            </div>


            <div class="property-card-content">

                <h2>${escapeHTML(property.title)}</h2>

                <p>Location: ${escapeHTML(locationText)}</p>

                <p>Price: ${escapeHTML(property.price)} EGP</p>

                ${property.owner_name
                    ? `<p>Owner: ${escapeHTML(property.owner_name)}</p>`
                    : ''}

                ${property.owner_id
                    ? `<div>${ratingHTML(property.owner_id, property.owner_rating, property.owner_ratings_count)}</div>`
                    : ''}

                ${metaParts.length > 0
                    ? `<div class="property-meta">${metaParts.join("")}</div>`
                    : ''}

                ${isMine
                    ? '<span class="property-badge">Your Property</span>'
                    : ''}

                <div class="property-actions">

                    ${actionsHTML}

                </div>

            </div>

        `;

        container.appendChild(card);

    });

    if (shown === 0) {

        let message = "No properties available.";

        if (showMineOnly) {
            message =
                hasActiveFilters()
                    ? "None of your properties match these filters."
                    : "You have not added any properties yet.";
        } else if (hasActiveFilters()) {
            message = "No properties match your filters.";
        }

        container.innerHTML = `

            <p class="empty-message">${message}</p>

        `;
    }
}


// =========================
// PROPERTIES FILTER (ALL / MY PROPERTIES)
// =========================

function showAllProperties() {
    propertiesFilter = "all";
    updateFilterButtons();
    renderProperties();
}


function showMyProperties() {

    if (!getCurrentUser()) {
        return;
    }

    propertiesFilter = "mine";
    updateFilterButtons();
    renderProperties();
}


function updateFilterButtons() {

    const allBtn = document.getElementById("filter-all-btn");
    const mineBtn = document.getElementById("filter-mine-btn");

    if (allBtn) {
        allBtn.classList.toggle("active", propertiesFilter === "all");
    }

    if (mineBtn) {
        mineBtn.classList.toggle("active", propertiesFilter === "mine");
    }
}


// =========================
// MESSAGE THE OWNER OF A PROPERTY (from the card)
// =========================

function messageOwner(propertyId) {

    const user = getCurrentUser();

    if (!user) {
        alert("Please login first.");
        showLoginForm();
        return;
    }

    const property = getPropertyFromCache(propertyId);

    if (!property || !property.owner_id) {
        alert("This property has no owner to message.");
        return;
    }

    openChatWith(
        property.owner_id,
        property.owner_name || "Owner",
        property.id,
        property.title
    );
}


// =========================
// VIEW PROPERTY
// =========================

function viewProperty(id) {

    fetch(`${API}/api/properties/${id}`)

        .then(response => {

            if (!response.ok) {
                throw new Error("Property not found");
            }

            return response.json();

        })

        .then(property => {

            const isSold = property.status === "sold";

            const currentUser = getCurrentUser();

            const isMine =
                !!currentUser &&
                property.owner_id !== null &&
                property.owner_id !== undefined &&
                Number(property.owner_id) === Number(currentUser.id);

            // ---------- Gallery ----------

            const gallery = document.getElementById("modal-property-gallery");
            const mainImage = document.getElementById("modal-gallery-main");
            const thumbs = document.getElementById("modal-gallery-thumbs");
            const images = property.images || [];

            thumbs.innerHTML = "";

            if (images.length > 0) {

                mainImage.src = images[0].url;

                images.forEach((image, i) => {

                    const thumb = document.createElement("img");

                    thumb.src = image.url;

                    thumb.alt = "Property image " + (i + 1);

                    thumb.className =
                        "modal-gallery-thumb" +
                        (i === 0 ? " active" : "");

                    thumb.onclick = function () {

                        mainImage.src = image.url;

                        thumbs
                            .querySelectorAll(".modal-gallery-thumb")
                            .forEach(t => t.classList.remove("active"));

                        thumb.classList.add("active");

                    };

                    thumbs.appendChild(thumb);

                });

                thumbs.style.display = images.length > 1 ? "flex" : "none";

                gallery.style.display = "block";

            } else {

                mainImage.src = "";

                gallery.style.display = "none";

            }

            // ---------- Text ----------

            document.getElementById("modal-property-title").textContent = property.title;

            const statusBadge = document.getElementById("modal-property-status");

            statusBadge.textContent = isSold ? "Sold" : "Available";

            statusBadge.className =
                "status-badge status-" +
                (isSold ? "sold" : "available");

            statusBadge.style.display = "inline-block";

            document.getElementById("modal-property-location").textContent =
                `Location: ${
                    property.governorate
                        ? property.governorate + " - " + property.location
                        : property.location
                }`;

            document.getElementById("modal-property-price").textContent =
                `Price: ${property.price} EGP`;

            // ---------- Type / phone / owner rating ----------

            document.getElementById("modal-property-type").textContent =
                property.property_type && typeLabel(property.property_type)
                    ? `Type: ${typeLabel(property.property_type)}`
                    : "";

            document.getElementById("modal-property-phone").innerHTML =
                property.phone
                    ? `Phone: <a href="tel:${escapeHTML(property.phone)}">${escapeHTML(property.phone)}</a>`
                    : "";

            document.getElementById("modal-property-rating").innerHTML =
                ratingHTML(property.owner_id, property.owner_rating, property.owner_ratings_count);

            // ---------- Bedrooms / bathrooms / area ----------

            const detailParts = [];

            if (property.bedrooms !== null && property.bedrooms !== undefined) {
                detailParts.push(
                    `<span class="detail-chip">${escapeHTML(property.bedrooms)} Bedrooms</span>`
                );
            }

            if (property.bathrooms !== null && property.bathrooms !== undefined) {
                detailParts.push(
                    `<span class="detail-chip">${escapeHTML(property.bathrooms)} Bathrooms</span>`
                );
            }

            if (property.area !== null && property.area !== undefined) {
                detailParts.push(
                    `<span class="detail-chip">${escapeHTML(property.area)} m²</span>`
                );
            }

            const detailsBox = document.getElementById("modal-property-details");

            detailsBox.innerHTML = detailParts.join("");

            detailsBox.style.display = detailParts.length > 0 ? "flex" : "none";

            // ---------- Description ----------

            const descriptionBox = document.getElementById("modal-property-description");

            if (property.description) {
                descriptionBox.textContent = property.description;
                descriptionBox.style.display = "block";
            } else {
                descriptionBox.textContent = "";
                descriptionBox.style.display = "none";
            }

            // ---------- Owner name ----------

            document.getElementById("modal-property-owner").textContent =
                property.owner_id
                    ? `Listed by ${property.owner_name || "Owner #" + property.owner_id}${isMine ? " (You)" : ""}`
                    : "Listed by ZIZO ESTATES";

            // ---------- Message Owner ----------

            const chatBtn = document.getElementById("modal-chat-btn");

            if (!isMine && property.owner_id) {

                chatBtn.style.display = "block";

                chatBtn.onclick = function () {

                    if (!getCurrentUser()) {
                        alert("Please login first.");
                        showLoginForm();
                        return;
                    }

                    closePropertyModal();

                    openChatWith(
                        property.owner_id,
                        property.owner_name || "Owner",
                        property.id,
                        property.title
                    );

                };

            } else {

                chatBtn.style.display = "none";

                chatBtn.onclick = null;

            }

            // ---------- Request to Buy ----------

            const requestBtn = document.getElementById("modal-request-btn");

            const role = getCurrentRole();

            // Regular users (and guests, who get asked to login),
            // only if not sold and not their own property
            if ((!role || role === "user") && !isSold && !isMine) {

                requestBtn.style.display = "block";

                requestBtn.onclick = function () {
                    requestToBuy(property.id);
                };

            } else {

                requestBtn.style.display = "none";

                requestBtn.onclick = null;

            }

            document.getElementById("property-modal").style.display = "flex";

        })

        .catch(error => {
            console.error("View Error:", error);
        });
}


// =========================
// CLOSE PROPERTY MODAL
// =========================

function closePropertyModal() {
    document.getElementById("property-modal").style.display = "none";
}


// =========================
// EDIT PROPERTY
// =========================

function editProperty(id, button) {

    const cached = propertiesCache.find(p => Number(p.id) === Number(id));

    if (cached && !canManageProperty(cached)) {
        alert("You can only edit your own properties.");
        return;
    }

    const card = button.closest("#properties-container > div");

    const oldForm = card.querySelector(".edit-property-form");

    if (oldForm) {
        oldForm.remove();
        return;
    }

    fetch(`${API}/api/properties/${id}`)

        .then(response => {

            if (!response.ok) {
                throw new Error("Property not found");
            }

            return response.json();

        })

        .then(property => {

            const form = document.createElement("div");

            form.className = "edit-property-form";

            const images = property.images || [];

            const imagesHTML =
                images
                    .map(image => `

                        <div class="edit-image-item">

                            <img src="${escapeHTML(image.url)}" alt="Property image">

                            <button
                                type="button"
                                class="edit-image-delete"
                                title="Delete image"
                                onclick="deletePropertyImage(${property.id}, ${image.id})">

                                ×

                            </button>

                        </div>

                    `)
                    .join("");

            const governorateOptions =
                '<option value="">Select Governorate</option>' +
                governorates
                    .map(name => `

                        <option
                            value="${escapeHTML(name)}"
                            ${name === property.governorate ? "selected" : ""}>

                            ${escapeHTML(name)}

                        </option>

                    `)
                    .join("");

            const typeOptions =
                '<option value="">Select Property Type</option>' +
                propertyTypes
                    .map(t => `

                        <option
                            value="${escapeHTML(t.value)}"
                            ${t.value === property.property_type ? "selected" : ""}>

                            ${escapeHTML(t.label)}

                        </option>

                    `)
                    .join("");

            form.innerHTML = `

                <input
                    type="text"
                    value="${escapeHTML(property.title)}"
                    id="edit-title-${property.id}"
                    placeholder="Property Title">


                <select id="edit-governorate-${property.id}">

                    ${governorateOptions}

                </select>


                <select id="edit-type-${property.id}">

                    ${typeOptions}

                </select>


                <input
                    type="text"
                    value="${escapeHTML(property.location)}"
                    id="edit-location-${property.id}"
                    placeholder="Detailed Location (area, street...)">


                <input
                    type="number"
                    value="${escapeHTML(property.price)}"
                    id="edit-price-${property.id}"
                    placeholder="Price">


                <input
                    type="tel"
                    value="${escapeHTML(property.phone ?? "")}"
                    id="edit-phone-${property.id}"
                    placeholder="Mobile (e.g. 01012345678)">


                <input
                    type="number"
                    min="0"
                    value="${escapeHTML(property.bedrooms ?? "")}"
                    id="edit-bedrooms-${property.id}"
                    placeholder="Bedrooms (optional)">


                <input
                    type="number"
                    min="0"
                    value="${escapeHTML(property.bathrooms ?? "")}"
                    id="edit-bathrooms-${property.id}"
                    placeholder="Bathrooms (optional)">


                <input
                    type="number"
                    min="0"
                    value="${escapeHTML(property.area ?? "")}"
                    id="edit-area-${property.id}"
                    placeholder="Area in m² (optional)">


                <textarea
                    id="edit-description-${property.id}"
                    rows="3"
                    maxlength="2000"
                    placeholder="Description (optional)">${escapeHTML(property.description ?? "")}</textarea>


                <button onclick="updateProperty(${property.id})">Update Property</button>


                <div class="edit-images">

                    <p class="form-hint">Images (${images.length}/8)</p>

                    <div class="edit-images-list">

                        ${imagesHTML}

                    </div>

                    <input
                        type="file"
                        id="edit-images-input-${property.id}"
                        accept="image/jpeg,image/png,image/webp"
                        multiple>

                    <button onclick="uploadPropertyImages(${property.id})">Upload Images</button>

                </div>

            `;

            card.appendChild(form);

        })

        .catch(error => {
            console.error("Edit Error:", error);
        });
}


// =========================
// REOPEN EDIT FORM (after an image upload / delete)
// =========================

function reopenEditForm(id) {

    const card =
        document.querySelector(
            `#properties-container > div[data-property-id="${id}"]`
        );

    if (!card) {
        return;
    }

    const button = card.querySelector('[data-action="edit"]');

    if (button) {
        editProperty(id, button);
    }
}


// =========================
// UPDATE PROPERTY
// =========================

function updateProperty(id) {

    const title = document.getElementById(`edit-title-${id}`).value;
    const governorate = document.getElementById(`edit-governorate-${id}`).value;
    const propertyType = document.getElementById(`edit-type-${id}`).value;
    const location = document.getElementById(`edit-location-${id}`).value;
    const price = document.getElementById(`edit-price-${id}`).value;
    const phone = document.getElementById(`edit-phone-${id}`).value.trim();
    const bedrooms = document.getElementById(`edit-bedrooms-${id}`).value;
    const bathrooms = document.getElementById(`edit-bathrooms-${id}`).value;
    const area = document.getElementById(`edit-area-${id}`).value;
    const description = document.getElementById(`edit-description-${id}`).value;

    if (title === "" || location === "" || price === "") {
        alert("Please fill in all fields.");
        return;
    }

    const token = getAuthToken();

    if (!token) {
        alert("Please login first.");
        showLoginForm();
        return;
    }

    const body = {
        title: title,
        location: location,
        price: Number(price),

        // An empty value clears the optional field
        bedrooms: bedrooms === "" ? "" : Number(bedrooms),
        bathrooms: bathrooms === "" ? "" : Number(bathrooms),
        area: area === "" ? "" : Number(area),
        description: description.trim()
    };

    // These are sent only when they have a value
    if (governorate !== "") {
        body.governorate = governorate;
    }

    if (propertyType !== "") {
        body.property_type = propertyType;
    }

    if (phone !== "") {
        body.phone = phone;
    }

    apiRequest(`${API}/api/properties/${id}`, {
        method: "PUT",
        body: JSON.stringify(body)
    })

        .then(result => {
            console.log("Property updated:", result);
            alert("Property updated successfully!");
            loadProperties();
        })

        .catch(error => {
            console.error("Update Error:", error);
            alert(error.message);
        });
}


// =========================
// UPLOAD IMAGES TO AN EXISTING PROPERTY
// =========================

function uploadPropertyImages(id) {

    const input = document.getElementById(`edit-images-input-${id}`);

    if (!input) {
        return;
    }

    const files = Array.from(input.files);

    if (files.length === 0) {
        alert("Please select at least one image.");
        return;
    }

    const error = validateImageFiles(files);

    if (error) {
        alert(error);
        return;
    }

    const formData = new FormData();

    files.forEach(file => {
        formData.append("images", file);
    });

    apiRequest(`${API}/api/properties/${id}/images`, {
        method: "POST",
        body: formData
    })

        .then(result => {
            console.log("Images uploaded:", result);
            alert("Images uploaded successfully!");
            loadProperties().then(() => reopenEditForm(id));
        })

        .catch(error => {
            console.error("Upload Images Error:", error);
            alert(error.message);
        });
}


// =========================
// DELETE A PROPERTY IMAGE
// =========================

function deletePropertyImage(propertyId, imageId) {

    const confirmed = confirm("Delete this image?");

    if (!confirmed) {
        return;
    }

    apiRequest(`${API}/api/properties/${propertyId}/images/${imageId}`, {
        method: "DELETE"
    })

        .then(result => {
            console.log(result);
            loadProperties().then(() => reopenEditForm(propertyId));
        })

        .catch(error => {
            console.error("Delete Image Error:", error);
            alert(error.message);
        });
}


// =========================
// MARK PROPERTY AS SOLD / AVAILABLE
// =========================

function togglePropertyStatus(id, status) {

    const confirmed =
        confirm(
            status === "sold"
                ? "Mark this property as sold?"
                : "Make this property available again?"
        );

    if (!confirmed) {
        return;
    }

    apiRequest(`${API}/api/properties/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: status })
    })

        .then(result => {
            console.log(result);
            alert(result.message || "Property status updated successfully!");
            loadProperties();
        })

        .catch(error => {
            console.error("Property Status Error:", error);
            alert(error.message);
        });
}


// =========================
// DELETE PROPERTY
// =========================

function deleteProperty(id) {

    const cached = propertiesCache.find(p => Number(p.id) === Number(id));

    if (cached && !canManageProperty(cached)) {
        alert("You can only delete your own properties.");
        return;
    }

    const confirmed = confirm("Are you sure you want to delete this property?");

    if (!confirmed) {
        return;
    }

    const token = getAuthToken();

    if (!token) {
        alert("Please login first.");
        showLoginForm();
        return;
    }

    apiRequest(`${API}/api/properties/${id}`, {
        method: "DELETE"
    })

        .then(result => {

            console.log(result);

            alert("Property deleted successfully!");

            loadProperties();

            // Requests of a deleted property may be affected
            applyRoleUI();

        })

        .catch(error => {
            console.error("Delete Error:", error);
            alert(error.message);
        });
}


// =========================
// SHOW ADD PROPERTY FORM
// =========================

function showAddForm() {

    const token = getAuthToken();

    if (!token) {
        alert("Please login first.");
        showLoginForm();
        return;
    }

    const form = document.getElementById("add-property-form");

    if (form.style.display === "none") {
        form.style.display = "block";
    } else {
        form.style.display = "none";
    }
}


// =========================
// ADD PROPERTY
// (sent as FormData so the images can travel with it)
// Required: title, governorate, property type, location, price, phone
// =========================

function submitProperty() {

    const title = document.getElementById("property-title").value;
    const governorate = document.getElementById("property-governorate").value;
    const propertyType = document.getElementById("property-type").value;
    const location = document.getElementById("property-location").value;
    const price = document.getElementById("property-price").value;
    const phone = document.getElementById("property-phone").value.trim();
    const bedrooms = document.getElementById("property-bedrooms").value;
    const bathrooms = document.getElementById("property-bathrooms").value;
    const area = document.getElementById("property-area").value;
    const description = document.getElementById("property-description").value.trim();
    const imagesInput = document.getElementById("property-images");

    if (
        title === "" ||
        governorate === "" ||
        propertyType === "" ||
        location === "" ||
        price === "" ||
        phone === ""
    ) {
        alert("Please fill in the title, governorate, type, location, price and phone.");
        return;
    }

    const files = Array.from(imagesInput.files);

    const filesError = validateImageFiles(files);

    if (filesError) {
        alert(filesError);
        return;
    }

    const token = getAuthToken();

    if (!token) {
        alert("Please login first.");
        showLoginForm();
        return;
    }

    const formData = new FormData();

    formData.append("title", title);
    formData.append("governorate", governorate);
    formData.append("property_type", propertyType);
    formData.append("location", location);
    formData.append("price", Number(price));
    formData.append("phone", phone);

    if (bedrooms !== "") {
        formData.append("bedrooms", bedrooms);
    }

    if (bathrooms !== "") {
        formData.append("bathrooms", bathrooms);
    }

    if (area !== "") {
        formData.append("area", area);
    }

    if (description !== "") {
        formData.append("description", description);
    }

    files.forEach(file => {
        formData.append("images", file);
    });

    apiRequest(`${API}/api/properties`, {
        method: "POST",
        body: formData
    })

        .then(result => {

            console.log("Property added:", result);

            alert("Property added successfully!");

            loadProperties();

            document.getElementById("property-title").value = "";
            document.getElementById("property-governorate").value = "";
            document.getElementById("property-type").value = "";
            document.getElementById("property-location").value = "";
            document.getElementById("property-price").value = "";
            document.getElementById("property-phone").value = "";
            document.getElementById("property-bedrooms").value = "";
            document.getElementById("property-bathrooms").value = "";
            document.getElementById("property-area").value = "";
            document.getElementById("property-description").value = "";

            imagesInput.value = "";

            previewSelectedImages(imagesInput);

            document.getElementById("add-property-form").style.display = "none";

        })

        .catch(error => {
            console.error("Add Property Error:", error);
            alert(error.message);
        });
}


// =========================
// REQUEST TO BUY (USER ONLY)
// After the request is sent, the buyer can message the owner right away
// =========================

function requestToBuy(propertyId) {

    const user = getCurrentUser();

    if (!user) {
        alert("Please login first.");
        showLoginForm();
        return;
    }

    if (user.role !== "user") {
        alert("Only regular users can submit purchase requests.");
        return;
    }

    const targetProperty = getPropertyFromCache(propertyId);

    if (
        targetProperty &&
        targetProperty.owner_id &&
        Number(targetProperty.owner_id) === Number(user.id)
    ) {
        alert("You cannot buy your own property.");
        return;
    }

    if (targetProperty && targetProperty.status === "sold") {
        alert("This property is no longer available.");
        return;
    }

    // The backend also blocks duplicates, this just saves a round trip
    const alreadyPending =
        myRequestsCache.some(
            r =>
                Number(r.property_id) === Number(propertyId) &&
                r.status === "pending"
        );

    if (alreadyPending) {
        alert("You already have a pending request for this property.");
        return;
    }

    const confirmed = confirm("Send a purchase request for this property?");

    if (!confirmed) {
        return;
    }

    apiRequest(`${API}/api/purchase-requests`, {
        method: "POST",
        body: JSON.stringify({ property_id: propertyId })
    })

        .then(result => {

            console.log("Purchase request created:", result);

            alert("Purchase request sent successfully!");

            closePropertyModal();

            loadMyRequests();

            // Offer the chat with the owner
            if (
                targetProperty &&
                targetProperty.owner_id &&
                confirm("Do you want to message the owner about this property now?")
            ) {
                openChatWith(
                    targetProperty.owner_id,
                    targetProperty.owner_name || "Owner",
                    targetProperty.id,
                    targetProperty.title
                );
            }

        })

        .catch(error => {
            console.error("Purchase Request Error:", error);
            alert(error.message);
        });
}


// =========================
// REQUESTS HELPERS
// =========================

function getPropertyFromCache(propertyId) {
    return propertiesCache.find(p => Number(p.id) === Number(propertyId));
}


function formatStatus(status) {
    const value = status || "pending";
    return value.charAt(0).toUpperCase() + value.slice(1);
}


function formatRequestDate(request) {

    if (!request.created_at) {
        return "";
    }

    const date = new Date(request.created_at);

    if (isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString();
}


// =========================
// MY PURCHASE REQUESTS (BUYER)
// =========================

function loadMyRequests() {

    apiRequest(`${API}/api/purchase-requests/my`)

        .then(requests => {
            myRequestsCache = requests;
            renderMyRequests();
        })

        .catch(error => {
            console.error("My Requests Error:", error);
        });
}


function renderMyRequests() {

    const container = document.getElementById("my-requests-container");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (myRequestsCache.length === 0) {

        container.innerHTML = `

            <p class="empty-message">You have not sent any purchase requests yet.</p>

        `;

        return;
    }

    myRequestsCache.forEach(request => {

        // The backend returns the property details with each request
        const cachedProperty = getPropertyFromCache(request.property_id);

        const title =
            request.title ||
            (cachedProperty ? cachedProperty.title : null);

        const location =
            request.location ||
            (cachedProperty ? cachedProperty.location : null);

        const price =
            request.price ??
            (cachedProperty ? cachedProperty.price : null);

        const date = formatRequestDate(request);

        const card = document.createElement("div");

        card.className = "request-card";

        card.innerHTML = `

            <div class="request-info">

                <h3>
                    ${title
                        ? escapeHTML(title)
                        : "Property #" + escapeHTML(request.property_id)}
                </h3>

                ${title ? `

                    <p>Location: ${escapeHTML(location)}</p>

                    <p>Price: ${escapeHTML(price)} EGP</p>

                    ${request.owner_name
                        ? `<p>Owner: ${escapeHTML(request.owner_name)}</p>`
                        : ""}

                    ${request.status === "approved" && request.owner_phone
                        ? `<p>Owner phone: <a href="tel:${escapeHTML(request.owner_phone)}">${escapeHTML(request.owner_phone)}</a></p>`
                        : ""}

                ` : `

                    <p>This property is no longer available.</p>

                `}

                ${date ? `<p>Requested on: ${escapeHTML(date)}</p>` : ""}

            </div>

            <div class="request-side">

                <span class="status-badge status-${escapeHTML(request.status)}">
                    ${escapeHTML(formatStatus(request.status))}
                </span>

                ${request.status === "approved"
                    ? (request.my_rating
                        ? `<span class="owner-rating">Your rating: ★ ${escapeHTML(request.my_rating)}</span>`
                        : `<button class="chat-request-btn" onclick="rateOwner(${request.id})">Rate Owner</button>`)
                    : ""}

                ${request.owner_id
                    ? `

                        <button
                            class="chat-request-btn"
                            onclick="messageOwnerFromRequest(${request.id})">

                            Message Owner

                        </button>

                    `
                    : ""}

            </div>

        `;

        container.appendChild(card);

    });
}


// Buyer -> owner chat (from "My Purchase Requests")

function messageOwnerFromRequest(requestId) {

    const request = myRequestsCache.find(r => Number(r.id) === Number(requestId));

    if (!request || !request.owner_id) {
        alert("The owner of this property is no longer available.");
        return;
    }

    openChatWith(
        request.owner_id,
        request.owner_name || "Owner",
        request.property_id,
        request.title
    );
}


// =========================
// PURCHASE REQUESTS ON MY PROPERTIES (OWNER) / ALL (ADMIN)
// =========================

function loadOwnerRequests() {

    apiRequest(`${API}/api/purchase-requests/owner`)

        .then(requests => {
            ownerRequestsCache = requests;
            renderOwnerRequests();
        })

        .catch(error => {
            console.error("Owner Requests Error:", error);
        });
}


function renderOwnerRequests() {

    const container = document.getElementById("owner-requests-container");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (ownerRequestsCache.length === 0) {

        container.innerHTML = `

            <p class="empty-message">No purchase requests yet.</p>

        `;

        return;
    }

    ownerRequestsCache.forEach(request => {

        const date = formatRequestDate(request);

        const card = document.createElement("div");

        card.className = "request-card";

        // Approve / Reject only while the request is still pending
        const actionsHTML =
            request.status === "pending"
                ? `

                    <div class="request-actions">

                        <button class="approve-btn" onclick="approveRequest(${request.id})">Approve</button>

                        <button class="reject-btn" onclick="rejectRequest(${request.id})">Reject</button>

                    </div>

                `
                : "";

        card.innerHTML = `

            <div class="request-info">

                <h3>${escapeHTML(request.title)}</h3>

                <p>Location: ${escapeHTML(request.location)}</p>

                <p>Price: ${escapeHTML(request.price)} EGP</p>

                <p>Buyer: ${escapeHTML(request.buyer_name || ("User #" + request.user_id))}</p>

                ${request.buyer_email
                    ? `<p>Email: ${escapeHTML(request.buyer_email)}</p>`
                    : ""}

                ${date ? `<p>Requested on: ${escapeHTML(date)}</p>` : ""}

            </div>

            <div class="request-side">

                <span class="status-badge status-${escapeHTML(request.status)}">
                    ${escapeHTML(formatStatus(request.status))}
                </span>

                <button class="chat-request-btn" onclick="messageBuyer(${request.id})">Message Buyer</button>

                ${actionsHTML}

            </div>

        `;

        container.appendChild(card);

    });
}


// Owner -> buyer chat (from the requests on my properties)

function messageBuyer(requestId) {

    const request = ownerRequestsCache.find(r => Number(r.id) === Number(requestId));

    const buyerId =
        request
            ? (request.buyer_id || request.user_id)
            : null;

    if (!buyerId) {
        alert("The buyer of this request is no longer available.");
        return;
    }

    openChatWith(
        buyerId,
        request.buyer_name || "Buyer",
        request.property_id,
        request.title
    );
}


function approveRequest(id) {
    updateRequestStatus(id, "approve");
}


function rejectRequest(id) {
    updateRequestStatus(id, "reject");
}


function updateRequestStatus(id, action) {

    const confirmed =
        confirm(
            action === "approve"
                ? "Approve this request?\n\nThe property will be marked as sold and the other pending requests on it will be rejected."
                : "Are you sure you want to reject this request?"
        );

    if (!confirmed) {
        return;
    }

    apiRequest(`${API}/api/purchase-requests/${id}/${action}`, {
        method: "PUT"
    })

        .then(result => {

            console.log(result);

            alert(result.message || "Request updated successfully!");

            loadOwnerRequests();

            // Approving marks the property as sold
            loadProperties();

        })

        .catch(error => {

            console.error("Request Status Error:", error);

            alert(error.message);

            // The request may have already been decided
            loadOwnerRequests();

        });
}


// =========================
// USERS MANAGEMENT (ADMIN)
// =========================

function loadUsers() {

    apiRequest(`${API}/api/users`)

        .then(users => {
            usersCache = users;
            renderUsers();
        })

        .catch(error => {
            console.error("Users Error:", error);
        });
}


function renderUsers() {

    const container = document.getElementById("users-container");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const currentUser = getCurrentUser();

    if (usersCache.length === 0) {

        container.innerHTML = `

            <p class="empty-message">No users found.</p>

        `;

        return;
    }

    usersCache.forEach(user => {

        const isSelf =
            currentUser &&
            Number(user.id) === Number(currentUser.id);

        const card = document.createElement("div");

        card.className = "user-card";

        card.innerHTML = `

            <div class="request-info">

                <h3>
                    ${escapeHTML(user.name)}
                    ${isSelf ? '<span class="you-tag">(You)</span>' : ''}
                </h3>

                <p>${escapeHTML(user.email)}</p>

                <p>
                    Current role:
                    <span class="role-badge role-${escapeHTML(user.role)}">
                        ${escapeHTML(user.role)}
                    </span>
                </p>

            </div>

            <div class="user-actions">

                <select id="role-select-${user.id}" ${isSelf ? "disabled" : ""}>

                    <option value="user" ${user.role === "user" ? "selected" : ""}>User</option>

                    <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>

                </select>

                <button onclick="changeUserRole(${user.id})" ${isSelf ? "disabled" : ""}>Change Role</button>

                <button class="delete-user-btn" onclick="deleteUser(${user.id})" ${isSelf ? "disabled" : ""}>Delete User</button>

            </div>

        `;

        container.appendChild(card);

    });
}


function changeUserRole(id) {

    const select = document.getElementById(`role-select-${id}`);

    if (!select) {
        return;
    }

    const role = select.value;

    const confirmed =
        confirm(
            `Change this user's role to "${role}"?\n\nThe new role applies to the user immediately.`
        );

    if (!confirmed) {
        return;
    }

    apiRequest(`${API}/api/users/${id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: role })
    })

        .then(result => {
            console.log(result);
            alert(result.message || "User role updated successfully!");
            loadUsers();
        })

        .catch(error => {
            console.error("Change Role Error:", error);
            alert(error.message);
        });
}


function deleteUser(id) {

    const confirmed = confirm("Are you sure you want to delete this user?");

    if (!confirmed) {
        return;
    }

    apiRequest(`${API}/api/users/${id}`, {
        method: "DELETE"
    })

        .then(result => {
            console.log(result);
            alert(result.message || "User deleted successfully!");
            loadUsers();
        })

        .catch(error => {
            console.error("Delete User Error:", error);
            alert(error.message);
        });
}


// =========================
// NOTIFICATION BELL
// Number of unread messages (simple polling, no sockets)
// =========================

const BELL_POLL_MS = 10000;

const CHAT_POLL_MS = 5000;

let bellTimer = null;


function setBellCount(count) {

    const badge = document.getElementById("bell-count");

    if (!badge) {
        return;
    }

    const number = Number(count) || 0;

    badge.textContent = number > 99 ? "99+" : String(number);

    badge.style.display = number > 0 ? "flex" : "none";
}


function fetchUnreadCount() {

    if (!getCurrentUser()) {
        return Promise.resolve();
    }

    return apiRequest(`${API}/api/notifications/unread-count`)

        .then(data => {
            setBellCount(data.count);
        })

        .catch(error => {
            console.error("Bell Error:", error);
        });
}


function startBellPolling() {

    if (bellTimer) {
        clearInterval(bellTimer);
    }

    fetchUnreadCount();

    bellTimer = setInterval(fetchUnreadCount, BELL_POLL_MS);
}


function stopBellPolling() {

    if (bellTimer) {
        clearInterval(bellTimer);
        bellTimer = null;
    }
}


// =========================
// CHAT (simple, polling based)
// A conversation is always between two users.
// Names are shown on both sides, not only ids.
// =========================

const chatState = {
    open: false,
    userId: null,
    userName: "",
    propertyId: null,
    propertyTitle: "",
    lastMessageId: 0,
    lastRenderedProperty: null,
    me: null,
    loading: false,
    pending: false,
    timer: null
};


let conversationsCache = [];


function formatChatTime(value) {

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleString([], {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    });
}


// ---------- open / close ----------

function showChatModal() {

    document.getElementById("chat-modal").style.display = "flex";

    chatState.open = true;

    startChatPolling();
}


// Opens the chat window with the list of conversations
function openChat() {

    if (!getCurrentUser()) {
        alert("Please login first.");
        showLoginForm();
        return;
    }

    showChatModal();

    resetActiveChat();

    loadConversations();
}


// Opens the chat window directly on a conversation with one user
function openChatWith(userId, userName, propertyId, propertyTitle) {

    const user = getCurrentUser();

    if (!user) {
        alert("Please login first.");
        showLoginForm();
        return;
    }

    if (Number(userId) === Number(user.id)) {
        alert("You cannot send a message to yourself.");
        return;
    }

    showChatModal();

    loadConversations();

    openConversation(userId, userName, propertyId, propertyTitle);
}


function closeChat() {

    const modal = document.getElementById("chat-modal");

    if (modal) {
        modal.style.display = "none";
    }

    chatState.open = false;

    if (chatState.timer) {
        clearInterval(chatState.timer);
        chatState.timer = null;
    }

    resetActiveChat();
}


function resetActiveChat() {

    chatState.userId = null;
    chatState.userName = "";
    chatState.propertyId = null;
    chatState.propertyTitle = "";
    chatState.lastMessageId = 0;
    chatState.lastRenderedProperty = null;
    chatState.me = null;

    const thread = document.getElementById("chat-thread");
    const empty = document.getElementById("chat-empty");
    const messages = document.getElementById("chat-messages");
    const layout = document.querySelector(".chat-layout");

    if (thread) {
        thread.style.display = "none";
    }

    if (empty) {
        empty.style.display = "flex";
    }

    if (messages) {
        messages.innerHTML = "";
    }

    if (layout) {
        layout.classList.remove("thread-open");
    }

    highlightActiveConversation();
}


// Mobile: go back from a conversation to the list
function showConversationList() {
    resetActiveChat();
    loadConversations();
}


function startChatPolling() {

    if (chatState.timer) {
        clearInterval(chatState.timer);
    }

    chatState.timer = setInterval(function () {

        if (!chatState.open) {
            return;
        }

        loadConversations();

        if (chatState.userId) {
            loadThread();
        }

    }, CHAT_POLL_MS);
}


// ---------- conversations list ----------

function loadConversations() {

    if (!getCurrentUser()) {
        return Promise.resolve();
    }

    return apiRequest(`${API}/api/messages/conversations`)

        .then(list => {
            conversationsCache = list;
            renderConversations();
        })

        .catch(error => {
            console.error("Conversations Error:", error);
        });
}


function renderConversations() {

    const container = document.getElementById("chat-conversations");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (conversationsCache.length === 0) {

        container.innerHTML = `

            <p class="chat-sidebar-empty">No conversations yet.</p>

        `;

        return;
    }

    const currentUser = getCurrentUser();

    conversationsCache.forEach(conversation => {

        const item = document.createElement("div");

        item.className = "chat-conversation";

        item.dataset.userId = conversation.user_id;

        const preview =
            (
                Number(conversation.last_sender_id) === Number(currentUser.id)
                    ? "You: "
                    : ""
            ) +
            String(conversation.last_message || "").slice(0, 60);

        item.innerHTML = `

            <div class="chat-conversation-top">

                <h4>${escapeHTML(conversation.user_name)}</h4>

                ${conversation.unread_count > 0
                    ? `<span class="chat-unread">${escapeHTML(conversation.unread_count)}</span>`
                    : ""}

            </div>

            ${conversation.last_property_title
                ? `<p class="chat-conversation-property">${escapeHTML(conversation.last_property_title)}</p>`
                : ""}

            <p class="chat-conversation-preview">${escapeHTML(preview)}</p>

        `;

        item.addEventListener("click", function () {
            openConversation(
                conversation.user_id,
                conversation.user_name,
                conversation.last_property_id,
                conversation.last_property_title
            );
        });

        container.appendChild(item);

    });

    highlightActiveConversation();
}


function highlightActiveConversation() {

    document
        .querySelectorAll(".chat-conversation")
        .forEach(item => {
            item.classList.toggle(
                "active",
                chatState.userId !== null &&
                Number(item.dataset.userId) === Number(chatState.userId)
            );
        });
}


// ---------- one conversation ----------

function openConversation(userId, userName, propertyId, propertyTitle) {

    chatState.userId = Number(userId);
    chatState.userName = userName || "User";
    chatState.propertyId = propertyId ? Number(propertyId) : null;
    chatState.propertyTitle = propertyTitle || "";
    chatState.lastMessageId = 0;
    chatState.lastRenderedProperty = null;
    chatState.me = null;

    document.getElementById("chat-empty").style.display = "none";

    document.getElementById("chat-thread").style.display = "flex";

    document.getElementById("chat-messages").innerHTML = "";

    document.querySelector(".chat-layout").classList.add("thread-open");

    document.getElementById("chat-with-name").textContent = chatState.userName;

    document.getElementById("chat-with-property").textContent =
        chatState.propertyTitle
            ? `About: ${chatState.propertyTitle}`
            : "";

    highlightActiveConversation();

    loadThread();

    document.getElementById("chat-input").focus();
}


function loadThread() {

    const userId = chatState.userId;

    if (!userId) {
        return Promise.resolve();
    }

    // One request at a time; a new one runs right after the current one
    if (chatState.loading) {
        chatState.pending = true;
        return Promise.resolve();
    }

    chatState.loading = true;

    return apiRequest(
        `${API}/api/messages/with/${userId}?after=${chatState.lastMessageId}`
    )

        .then(data => {

            // The user switched to another conversation meanwhile
            if (Number(chatState.userId) !== Number(userId)) {
                return;
            }

            chatState.me = data.me;

            chatState.userName = data.user.name;

            document.getElementById("chat-with-name").textContent = data.user.name;

            appendMessages(data.messages);

            // Reading the messages clears them from the bell
            fetchUnreadCount();

            if (data.messages.length > 0) {
                loadConversations();
            }

        })

        .catch(error => {
            console.error("Chat Error:", error);
        })

        .finally(() => {

            chatState.loading = false;

            if (chatState.pending) {
                chatState.pending = false;
                loadThread();
            }

        });
}


function appendMessages(messages) {

    const container = document.getElementById("chat-messages");

    if (!container) {
        return;
    }

    const currentUser = getCurrentUser();

    const fresh = messages.filter(m => Number(m.id) > chatState.lastMessageId);

    const hint = container.querySelector(".chat-no-messages");

    if (fresh.length === 0) {

        if (chatState.lastMessageId === 0 && !hint) {

            container.innerHTML = `

                <p class="chat-no-messages">
                    No messages yet. Say hello to ${escapeHTML(chatState.userName)}!
                </p>

            `;
        }

        return;
    }

    if (hint) {
        hint.remove();
    }

    fresh.forEach(message => {

        const mine = Number(message.sender_id) === Number(currentUser.id);

        const senderName =
            mine
                ? (chatState.me ? chatState.me.name : currentUser.name)
                : chatState.userName;

        // Show the property title when the topic changes
        if (
            message.property_id &&
            Number(message.property_id) !== Number(chatState.lastRenderedProperty)
        ) {

            const tag = document.createElement("div");

            tag.className = "chat-property-tag";

            tag.textContent =
                `About: ${message.property_title || "Property #" + message.property_id}`;

            container.appendChild(tag);

            chatState.lastRenderedProperty = message.property_id;
        }

        const bubble = document.createElement("div");

        bubble.className = "chat-message " + (mine ? "mine" : "theirs");

        bubble.innerHTML = `

            <span class="chat-sender">${escapeHTML(senderName)}</span>

            <p>${escapeHTML(message.body)}</p>

            <span class="chat-time">${escapeHTML(formatChatTime(message.created_at))}</span>

        `;

        container.appendChild(bubble);

        chatState.lastMessageId =
            Math.max(chatState.lastMessageId, Number(message.id));

    });

    container.scrollTop = container.scrollHeight;
}


function sendChatMessage() {

    const input = document.getElementById("chat-input");
    const button = document.getElementById("chat-send-btn");
    const body = input.value.trim();

    if (!body || !chatState.userId) {
        return;
    }

    button.disabled = true;

    const payload = {
        receiver_id: chatState.userId,
        body: body
    };

    if (chatState.propertyId) {
        payload.property_id = chatState.propertyId;
    }

    apiRequest(`${API}/api/messages`, {
        method: "POST",
        body: JSON.stringify(payload)
    })

        .then(() => {
            input.value = "";
            return loadThread();
        })

        .catch(error => {
            console.error("Send Message Error:", error);
            alert(error.message);
        })

        .finally(() => {
            button.disabled = false;
            input.focus();
        });
}


// =========================
// START
// =========================

loadGovernorates();

loadPropertyTypes();

loadProperties();


// =========================
// CHECK LOGIN ON PAGE LOAD
// =========================

updateNavbar();


// Get the real current role from the backend (/api/me)

refreshCurrentUser();


// Send the chat message with the Enter key

document
    .getElementById("chat-input")
    .addEventListener("keydown", function (event) {

        if (event.key === "Enter") {
            event.preventDefault();
            sendChatMessage();
        }

    });


// Check again when the user comes back to the tab
// (e.g. an admin changed their role in the meantime)

window.addEventListener("focus", function () {
    refreshCurrentUser();
});


// Auto logout when the 1 hour token expires while the page is open

setInterval(function () {

    const token = getAuthToken();

    if (token && isTokenExpired(token)) {
        handleSessionExpired();
        alert("Your session has expired. Please login again.");
    }

}, 60000);