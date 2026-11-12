// =========================================================
// script.js - LabCare
// Stage 3: sidebar navigation
// Stage 5.1: connection to Supabase
// Stage 6: login, sign-up and logout
// Stage 7: requests, workflow, comments, history, reports
// =========================================================


// ---------- 0. SUPABASE CONNECTION ----------

// Paste your two values from: Supabase dashboard -> Project Settings -> API
// Use ONLY the Project URL and the publishable (anon) key.
// NEVER put the secret / service_role key in this file.
const SUPABASE_URL = "https://nitvzttzevjnmjhqctab.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_DMA_mdNAU9PbdW3bOsRPkQ_-iyLbhKX";

// Our connection to Supabase. It stays null if something is missing.
// (Not called "supabase", because the library itself already uses that name.)
let supabaseClient = null;

if (typeof supabase === "undefined") {
  // The <script> tag for the library did not load (for example, no internet)
  console.error("Supabase library did not load. Check your internet connection.");
} else if (SUPABASE_URL.startsWith("PASTE") || SUPABASE_PUBLISHABLE_KEY.startsWith("PASTE")) {
  console.warn("Supabase is not set up yet: paste your Project URL and publishable key at the top of script.js.");
} else {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  console.log("Supabase client created.");
}


// ---------- 1. FIND THE ELEMENTS WE NEED ----------

// All six sidebar menu buttons (they all have class "nav-link")
const navButtons = document.querySelectorAll(".nav-link");

// All seven sections (they all have class "page")
const pages = document.querySelectorAll(".page");


// ---------- 2. FUNCTION: SHOW ONE SECTION ----------
// sectionId is the id of the section to show, for example "report"

function showSection(sectionId) {

  // Step A: hide every section by removing "active"
  for (let i = 0; i < pages.length; i++) {
    pages[i].classList.remove("active");
  }

  // Step B: show only the chosen section by adding "active"
  const chosenPage = document.getElementById(sectionId);
  chosenPage.classList.add("active");

  // Step C: highlight the matching menu button, un-highlight the others
  for (let i = 0; i < navButtons.length; i++) {
    const buttonTarget = navButtons[i].getAttribute("data-section");

    if (buttonTarget === sectionId) {
      navButtons[i].classList.add("active");
    } else {
      navButtons[i].classList.remove("active");
    }
  }
}


// ---------- 3. MAKE EACH MENU BUTTON CLICKABLE ----------

for (let i = 0; i < navButtons.length; i++) {
  navButtons[i].addEventListener("click", function () {
    const sectionId = navButtons[i].getAttribute("data-section");
    showSection(sectionId);
  });
}


// ---------- 4. START ON THE DASHBOARD ----------

showSection("dashboard");


// ---------- 5. AUTHENTICATION (Stage 6) ----------
// "async" lets a function wait for answers from the internet using "await".


// 5a. Elements we need
const appWrapper     = document.querySelector(".app");
const authScreen     = document.getElementById("auth-screen");
const authLoading    = document.getElementById("auth-loading");
const authForms      = document.getElementById("auth-forms");
const authMessage    = document.getElementById("auth-message");
const loginTab       = document.getElementById("login-tab");
const signupTab      = document.getElementById("signup-tab");
const loginForm      = document.getElementById("login-form");
const signupForm     = document.getElementById("signup-form");
const loginButton    = document.getElementById("login-button");
const signupButton   = document.getElementById("signup-button");
const userNameText   = document.getElementById("user-name");
const userRoleText   = document.getElementById("user-role");
const logoutButton   = document.getElementById("logout-btn");

// The signed-in user's details. null means nobody is signed in.
// Later stages will use currentUser.role to decide which buttons to show.
let currentUser = null;

// Friendly names for the three roles stored in the database
const roleNames = {
  reporter: "Reporter",
  technician: "Technician",
  incharge: "Lab In-charge"
};


// 5b. Messages on the login screen. type is "error", "info" or "success".
function showAuthMessage(text, type) {
  authMessage.textContent = text;          // textContent is safe: it never runs HTML
  authMessage.className = "auth-message " + type;
  authMessage.hidden = false;
}

function clearAuthMessage() {
  authMessage.textContent = "";
  authMessage.hidden = true;
}


// 5c. Switch between the "Log in" and "Sign up" tabs
function showLoginTab() {
  loginTab.classList.add("active");
  signupTab.classList.remove("active");
  loginForm.hidden = false;
  signupForm.hidden = true;
  clearAuthMessage();
}

function showSignupTab() {
  signupTab.classList.add("active");
  loginTab.classList.remove("active");
  signupForm.hidden = false;
  loginForm.hidden = true;
  clearAuthMessage();
}

loginTab.addEventListener("click", showLoginTab);
signupTab.addEventListener("click", showSignupTab);


// 5d. Show the login screen (and hide the app)
function showAuthScreen() {
  currentUser = null;
  clearAppData();                          // forget the previous user's data (Stage 7)
  appWrapper.hidden = true;
  authScreen.hidden = false;
  authLoading.hidden = true;
  authForms.hidden = false;
  userNameText.textContent = "Guest";
  userRoleText.textContent = "Not signed in";
}

// Show the app (and hide the login screen). Only called when currentUser is set.
function showApp() {
  userNameText.textContent = currentUser.fullName;
  userRoleText.textContent = roleNames[currentUser.role] || currentUser.role;
  clearAuthMessage();
  authScreen.hidden = true;
  appWrapper.hidden = false;
  showSection("dashboard");

  // Stage 7: technicians start with their own work; everyone else sees all requests
  filterShow.value = (currentUser.role === "technician") ? "assigned" : "all";
  refreshAllData();
}


// 5e. After a successful login: read this user's name and role from public.profiles
async function loadProfileAndEnter(user) {
  const result = await supabaseClient
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();                             // we expect exactly one row

  if (result.error) {
    // Logged in, but the profile could not be read: do NOT open the app
    console.error("Profile could not be loaded:", result.error.message);
    await supabaseClient.auth.signOut();
    showAuthScreen();
    showAuthMessage("You signed in, but your profile could not be loaded. Please try again or contact the administrator.", "error");
    return;
  }

  currentUser = {
    id: user.id,
    email: user.email,
    fullName: result.data.full_name,
    role: result.data.role                 // comes from the database, never from the user
  };
  showApp();
}


// 5f. LOGIN
loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();                  // stop the browser from reloading the page
  clearAuthMessage();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  loginButton.disabled = true;             // loading state
  loginButton.textContent = "Logging in…";

  const result = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (result.error) {
    if (result.error.code === "invalid_credentials") {
      showAuthMessage("Incorrect email or password.", "error");
    } else if (result.error.code === "email_not_confirmed") {
      showAuthMessage("Please confirm your email first. Check your inbox for the confirmation link.", "error");
    } else {
      showAuthMessage("Login failed: " + result.error.message, "error");
    }
  } else {
    document.getElementById("login-password").value = "";
    await loadProfileAndEnter(result.data.user);
  }

  loginButton.disabled = false;
  loginButton.textContent = "Log in";
});


// 5g. SIGN UP (name, email, password only - the role is always set by the database)
signupForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  clearAuthMessage();

  const fullName = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  if (fullName.length === 0) {
    showAuthMessage("Please enter your full name.", "error");
    return;
  }
  if (password.length < 6) {
    showAuthMessage("Password must be at least 6 characters.", "error");
    return;
  }

  signupButton.disabled = true;
  signupButton.textContent = "Creating account…";

  const result = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: { full_name: fullName },       // only the name; the signup trigger ignores anything else
      emailRedirectTo: window.location.origin + window.location.pathname
    }
  });

  if (result.error) {
    if (result.error.code === "user_already_exists") {
      showAuthMessage("An account with this email already exists. Please log in instead.", "error");
    } else if (result.error.code === "weak_password") {
      showAuthMessage("That password is too weak. Please choose a stronger one.", "error");
    } else if (result.error.code === "over_email_send_rate_limit") {
      showAuthMessage("Too many sign-up emails were sent. Please wait a while and try again.", "error");
    } else {
      showAuthMessage("Sign-up failed: " + result.error.message, "error");
    }
  } else if (result.data.session) {
    // Email confirmation is switched off: the user is signed in straight away
    await loadProfileAndEnter(result.data.user);
  } else if (result.data.user && result.data.user.identities && result.data.user.identities.length === 0) {
    // Supabase hides whether an email is already registered; an empty identities list means it is
    showAuthMessage("An account with this email already exists. Please log in instead.", "error");
  } else {
    // Normal case with email confirmation ON
    signupForm.reset();
    showLoginTab();
    showAuthMessage("Account created! Check your email and click the confirmation link, then log in.", "success");
  }

  signupButton.disabled = false;
  signupButton.textContent = "Create account";
});


// 5h. LOGOUT
logoutButton.addEventListener("click", async function () {
  logoutButton.disabled = true;
  await supabaseClient.auth.signOut();
  logoutButton.disabled = false;
  showLoginTab();
  showAuthScreen();
  showAuthMessage("You have been logged out.", "info");
});


// 5i. START-UP: is somebody already signed in? (the session is remembered by the browser)
async function startApp() {
  if (supabaseClient === null) {
    authLoading.textContent = "Cannot connect to the database. Check the Supabase settings at the top of script.js and your internet connection.";
    return;
  }

  // If the session ends while using the app (expired, or logged out in another tab),
  // go back to the login screen.
  supabaseClient.auth.onAuthStateChange(function (event) {
    if (event === "SIGNED_OUT" && currentUser !== null) {
      showLoginTab();
      showAuthScreen();
      showAuthMessage("Your session has ended. Please log in again.", "info");
    }
  });

  const result = await supabaseClient.auth.getSession();

  if (result.error || result.data.session === null) {
    showAuthScreen();
    // Coming back from an expired or invalid email confirmation link
    if (window.location.hash.includes("error_description")) {
      showAuthMessage("The confirmation link is invalid or has expired. Please log in, or sign up again.", "error");
    }
  } else {
    await loadProfileAndEnter(result.data.session.user);
  }
}


// ---------- 6. SHARED DATA AND HELPERS (Stage 7) ----------

let allRequests = [];        // every request, newest first (loaded from Supabase)
let profilesById = {};       // user id -> { id, full_name, role }, used to show names
let technicians = [];        // profiles whose role is "technician"
let selectedRequestId = null;  // the request open in Request Details
let lastLoadedAt = null;     // when the data was last loaded

const statusList = ["Open", "Assigned", "In Progress", "Resolved", "Closed"];
const priorityList = ["High", "Medium", "Low"];

const statusBadgeClass = {
  "Open": "badge-open",
  "Assigned": "badge-assigned",
  "In Progress": "badge-progress",
  "Resolved": "badge-resolved",
  "Closed": "badge-closed"
};

const priorityBadgeClass = { "Low": "badge-low", "Medium": "badge-medium", "High": "badge-high" };

// Elements used in several places
const recentTableBody     = document.getElementById("recent-table-body");
const requestsTableBody   = document.getElementById("requests-table-body");
const technicianTableBody = document.getElementById("technicians-table-body");
const repairTableBody     = document.getElementById("repair-table-body");
const requestsCount       = document.getElementById("requests-count");
const filterShow          = document.getElementById("filter-show");
const filterStatus        = document.getElementById("filter-status");
const filterPriority      = document.getElementById("filter-priority");
const detailsTitle        = document.getElementById("details-title");
const detailsMessage      = document.getElementById("details-message");
const detailsInfo         = document.getElementById("details-info");
const detailsActions      = document.getElementById("details-actions");
const commentsList        = document.getElementById("comments-list");
const commentForm         = document.getElementById("comment-form");
const commentText         = document.getElementById("comment-text");
const commentButton       = document.getElementById("comment-button");
const commentMessage      = document.getElementById("comment-message");
const historyList         = document.getElementById("history-list");
const reportsSummary      = document.getElementById("reports-summary");

// Forget everything when a user logs out
function clearAppData() {
  allRequests = [];
  profilesById = {};
  technicians = [];
  selectedRequestId = null;
}

// Message boxes inside the app. type is "error", "info" or "success".
function showMessage(element, text, type) {
  element.textContent = text;
  element.className = "message " + type;
  element.hidden = false;
}

function hideMessage(element) {
  element.textContent = "";
  element.hidden = true;
}

// Turn a user id into a name using the profiles we loaded
function personName(userId) {
  if (!userId) {
    return "—";
  }
  if (profilesById[userId]) {
    return profilesById[userId].full_name;
  }
  return "Unknown user";
}

// Dates are stored in UTC; show them in Indian time
function formatDate(value) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short"
  });
}

// Small coloured label, e.g. "High" or "In Progress"
function makeBadge(text, className) {
  const span = document.createElement("span");
  span.className = "badge " + className;
  span.textContent = text;
  return span;
}

// One table cell. content is either text or an element (badge / button).
function makeCell(content) {
  const cell = document.createElement("td");
  if (typeof content === "string") {
    cell.textContent = content;
  } else {
    cell.appendChild(content);
  }
  return cell;
}

// "View" button that opens a request in Request Details
function makeViewButton(requestId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-light btn-small";
  button.textContent = "View";
  button.addEventListener("click", function () {
    openRequestDetails(requestId);
  });
  return button;
}

// Replace a table's rows with one grey message row ("Loading…", "No requests yet")
function showTableMessage(tableBody, columnCount, text) {
  tableBody.replaceChildren();
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = columnCount;
  cell.className = "empty-cell";
  cell.textContent = text;
  row.appendChild(cell);
  tableBody.appendChild(row);
}

// Same idea for the comment and history lists
function showListMessage(list, text) {
  list.replaceChildren();
  const item = document.createElement("li");
  item.className = "muted";
  item.textContent = text;
  list.appendChild(item);
}

function countByStatus(status) {
  let count = 0;
  for (let i = 0; i < allRequests.length; i++) {
    if (allRequests[i].status === status) {
      count++;
    }
  }
  return count;
}

function findRequest(requestId) {
  for (let i = 0; i < allRequests.length; i++) {
    if (allRequests[i].id === requestId) {
      return allRequests[i];
    }
  }
  return null;
}


// ---------- 7. LOAD DATA FROM SUPABASE (Stage 7) ----------
// Called after login and after every successful change, so every page stays up to date.

async function refreshAllData() {
  showTableMessage(recentTableBody, 7, "Loading…");
  showTableMessage(requestsTableBody, 9, "Loading…");

  // 1. Names and roles of all users (signed-in users may read public.profiles)
  const profileResult = await supabaseClient
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name", { ascending: true });

  if (profileResult.error) {
    showLoadError(profileResult.error.message);
    return;
  }

  profilesById = {};
  technicians = [];
  for (let i = 0; i < profileResult.data.length; i++) {
    const profile = profileResult.data[i];
    profilesById[profile.id] = profile;
    if (profile.role === "technician") {
      technicians.push(profile);
    }
  }

  // 2. All requests, newest first (these are the real columns of public.requests)
  const requestResult = await supabaseClient
    .from("requests")
    .select("id, equipment_name, lab_location, description, priority, status, reported_by, assigned_to, created_at, closed_at, verified_by, rework_reason")
    .order("created_at", { ascending: false });

  if (requestResult.error) {
    showLoadError(requestResult.error.message);
    return;
  }

  allRequests = requestResult.data;
  lastLoadedAt = new Date();

  // 3. Draw every page from the fresh data
  renderDashboard();
  renderRequestsTable();
  renderTechnicians();
  renderRepairHistory();
  renderReports();
}

function showLoadError(text) {
  const message = "Could not load data: " + text;
  showTableMessage(recentTableBody, 7, message);
  showTableMessage(requestsTableBody, 9, message);
  showTableMessage(technicianTableBody, 5, message);
  showTableMessage(repairTableBody, 7, message);
  reportsSummary.textContent = message;
}


// ---------- 8. PAGES BUILT FROM THE DATA (Stage 7) ----------

// 8a. Dashboard
function renderDashboard() {
  document.getElementById("stat-total").textContent = allRequests.length;
  document.getElementById("stat-open").textContent = countByStatus("Open");
  document.getElementById("stat-assigned").textContent = countByStatus("Assigned");
  document.getElementById("stat-progress").textContent = countByStatus("In Progress");
  document.getElementById("stat-resolved").textContent = countByStatus("Resolved");
  document.getElementById("stat-closed").textContent = countByStatus("Closed");

  let highCount = 0;
  for (let i = 0; i < allRequests.length; i++) {
    if (allRequests[i].priority === "High" && allRequests[i].status !== "Closed") {
      highCount++;
    }
  }
  document.getElementById("stat-high").textContent = highCount;

  if (allRequests.length === 0) {
    showTableMessage(recentTableBody, 7, "No maintenance requests yet. Use Report Issue to create the first one.");
    return;
  }

  recentTableBody.replaceChildren();
  const howMany = Math.min(5, allRequests.length);
  for (let i = 0; i < howMany; i++) {
    const request = allRequests[i];
    const row = document.createElement("tr");
    row.appendChild(makeCell("#" + request.id));
    row.appendChild(makeCell(request.equipment_name));
    row.appendChild(makeCell(request.lab_location));
    row.appendChild(makeCell(makeBadge(request.priority, priorityBadgeClass[request.priority])));
    row.appendChild(makeCell(makeBadge(request.status, statusBadgeClass[request.status])));
    row.appendChild(makeCell(request.assigned_to ? personName(request.assigned_to) : "Not assigned"));
    row.appendChild(makeCell(makeViewButton(request.id)));
    recentTableBody.appendChild(row);
  }
}

// 8b. All Requests table with filters
function renderRequestsTable() {
  requestsTableBody.replaceChildren();
  let shown = 0;

  for (let i = 0; i < allRequests.length; i++) {
    const request = allRequests[i];

    // Skip rows that do not match the chosen filters
    if (filterShow.value === "reported" && request.reported_by !== currentUser.id) continue;
    if (filterShow.value === "assigned" && request.assigned_to !== currentUser.id) continue;
    if (filterStatus.value !== "All" && request.status !== filterStatus.value) continue;
    if (filterPriority.value !== "All" && request.priority !== filterPriority.value) continue;

    const row = document.createElement("tr");
    row.appendChild(makeCell("#" + request.id));
    row.appendChild(makeCell(request.equipment_name));
    row.appendChild(makeCell(request.lab_location));
    row.appendChild(makeCell(personName(request.reported_by)));
    row.appendChild(makeCell(request.assigned_to ? personName(request.assigned_to) : "Not assigned"));
    row.appendChild(makeCell(makeBadge(request.priority, priorityBadgeClass[request.priority])));
    row.appendChild(makeCell(makeBadge(request.status, statusBadgeClass[request.status])));
    row.appendChild(makeCell(formatDate(request.created_at)));
    row.appendChild(makeCell(makeViewButton(request.id)));
    requestsTableBody.appendChild(row);
    shown++;
  }

  if (allRequests.length === 0) {
    showTableMessage(requestsTableBody, 9, "No maintenance requests yet.");
  } else if (shown === 0) {
    showTableMessage(requestsTableBody, 9, "No requests match these filters.");
  }
  requestsCount.textContent = "Showing " + shown + " of " + allRequests.length + " requests.";
}

filterShow.addEventListener("change", renderRequestsTable);
filterStatus.addEventListener("change", renderRequestsTable);
filterPriority.addEventListener("change", renderRequestsTable);
document.getElementById("refresh-button").addEventListener("click", refreshAllData);

// 8c. Technicians and their workload
function renderTechnicians() {
  if (technicians.length === 0) {
    showTableMessage(technicianTableBody, 5, "No technicians yet. The administrator gives users the Technician role in Supabase.");
    return;
  }

  technicianTableBody.replaceChildren();
  for (let t = 0; t < technicians.length; t++) {
    const technician = technicians[t];
    const counts = { "Assigned": 0, "In Progress": 0, "Resolved": 0, "Closed": 0 };

    for (let i = 0; i < allRequests.length; i++) {
      const request = allRequests[i];
      if (request.assigned_to === technician.id && counts[request.status] !== undefined) {
        counts[request.status]++;
      }
    }

    const row = document.createElement("tr");
    row.appendChild(makeCell(technician.full_name));
    row.appendChild(makeCell(String(counts["Assigned"])));
    row.appendChild(makeCell(String(counts["In Progress"])));
    row.appendChild(makeCell(String(counts["Resolved"])));
    row.appendChild(makeCell(String(counts["Closed"])));
    technicianTableBody.appendChild(row);
  }
}

// 8d. Repair History page: closed requests, most recently closed first
function renderRepairHistory() {
  const closed = [];
  for (let i = 0; i < allRequests.length; i++) {
    if (allRequests[i].status === "Closed") {
      closed.push(allRequests[i]);
    }
  }
  closed.sort(function (a, b) {
    return new Date(b.closed_at) - new Date(a.closed_at);
  });

  if (closed.length === 0) {
    showTableMessage(repairTableBody, 7, "No closed repairs yet.");
    return;
  }

  repairTableBody.replaceChildren();
  for (let i = 0; i < closed.length; i++) {
    const request = closed[i];
    const row = document.createElement("tr");
    row.appendChild(makeCell("#" + request.id));
    row.appendChild(makeCell(request.equipment_name));
    row.appendChild(makeCell(request.lab_location));
    row.appendChild(makeCell(personName(request.assigned_to)));
    row.appendChild(makeCell(formatDate(request.closed_at)));
    row.appendChild(makeCell(request.verified_by ? personName(request.verified_by) : "Administrator"));
    row.appendChild(makeCell(makeViewButton(request.id)));
    repairTableBody.appendChild(row);
  }
}

// 8e. Reports: counts grouped by status, priority and lab
function renderReports() {
  const time = formatDate(lastLoadedAt);
  reportsSummary.textContent = "Based on " + allRequests.length + " request(s) loaded from the database at " + time + ".";

  // Status
  const statusCounts = [];
  for (let i = 0; i < statusList.length; i++) {
    statusCounts.push(countByStatus(statusList[i]));
  }
  fillBarChart(document.getElementById("report-status"), statusList, statusCounts);

  // Priority
  const priorityCounts = [];
  for (let p = 0; p < priorityList.length; p++) {
    let count = 0;
    for (let i = 0; i < allRequests.length; i++) {
      if (allRequests[i].priority === priorityList[p]) count++;
    }
    priorityCounts.push(count);
  }
  fillBarChart(document.getElementById("report-priority-chart"), priorityList, priorityCounts);

  // Lab (only labs that actually have requests)
  const labNames = [];
  const labCounts = [];
  for (let i = 0; i < allRequests.length; i++) {
    const lab = allRequests[i].lab_location;
    const position = labNames.indexOf(lab);
    if (position === -1) {
      labNames.push(lab);
      labCounts.push(1);
    } else {
      labCounts[position]++;
    }
  }
  fillBarChart(document.getElementById("report-lab-chart"), labNames, labCounts);
}

// Draw a simple bar chart: one row per label, bar width = share of all requests
function fillBarChart(container, labels, counts) {
  container.replaceChildren();

  if (labels.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No data yet.";
    container.appendChild(empty);
    return;
  }

  for (let i = 0; i < labels.length; i++) {
    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("span");
    label.textContent = labels[i];

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    let percent = 0;
    if (allRequests.length > 0) {
      percent = (counts[i] / allRequests.length) * 100;
    }
    fill.style.width = percent + "%";
    track.appendChild(fill);

    const number = document.createElement("span");
    number.className = "bar-count";
    number.textContent = counts[i];

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(number);
    container.appendChild(row);
  }
}


// ---------- 9. REPORT ISSUE FORM (Stage 7) ----------

const reportForm = document.getElementById("report-form");
const reportButton = document.getElementById("report-button");
const reportMessage = document.getElementById("report-message");

reportForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  hideMessage(reportMessage);

  const equipment = document.getElementById("report-equipment").value.trim();
  const lab = document.getElementById("report-lab").value;
  const description = document.getElementById("report-description").value.trim();
  const priority = document.getElementById("report-priority").value;

  // Same rules as the database CHECK constraints, so users get a clear message first
  if (equipment.length < 2) {
    showMessage(reportMessage, "Equipment name must be at least 2 characters.", "error");
    return;
  }
  if (lab === "") {
    showMessage(reportMessage, "Please choose a lab.", "error");
    return;
  }
  if (description.length < 5) {
    showMessage(reportMessage, "Please describe the problem (at least 5 characters).", "error");
    return;
  }
  if (priority === "") {
    showMessage(reportMessage, "Please choose a priority.", "error");
    return;
  }

  reportButton.disabled = true;            // stops double submission
  reportButton.textContent = "Submitting…";

  // Only these 4 columns are sent. The database fills in the rest itself:
  // reported_by = the signed-in user (auth.uid()), status = 'Open', created_at = now().
  const result = await supabaseClient
    .from("requests")
    .insert({
      equipment_name: equipment,
      lab_location: lab,
      description: description,
      priority: priority
    })
    .select("id")
    .single();

  reportButton.disabled = false;
  reportButton.textContent = "Submit report";

  if (result.error) {
    showMessage(reportMessage, "Could not submit the report: " + result.error.message, "error");
    return;
  }

  reportForm.reset();
  showMessage(reportMessage, "Request #" + result.data.id + " submitted. Its status is Open.", "success");
  await refreshAllData();
});


// ---------- 10. REQUEST DETAILS, ACTIONS, COMMENTS, HISTORY (Stage 7) ----------

document.getElementById("details-back").addEventListener("click", function () {
  showSection("requests");
});

// 10a. Open one request
async function openRequestDetails(requestId) {
  selectedRequestId = requestId;
  hideMessage(detailsMessage);
  hideMessage(commentMessage);
  commentText.value = "";
  showSection("details");
  window.scrollTo(0, 0);
  renderDetails();
  await loadComments();
  await loadHistory();
}

// 10b. Information card
function addInfo(label, value) {
  const term = document.createElement("dt");
  term.textContent = label;
  const detail = document.createElement("dd");
  if (typeof value === "string") {
    detail.textContent = value;
  } else {
    detail.appendChild(value);
  }
  detailsInfo.appendChild(term);
  detailsInfo.appendChild(detail);
}

function renderDetails() {
  const request = findRequest(selectedRequestId);
  detailsInfo.replaceChildren();
  detailsActions.replaceChildren();

  if (request === null) {
    detailsTitle.textContent = "Request not found";
    return;
  }

  detailsTitle.textContent = "Request #" + request.id + ": " + request.equipment_name;
  addInfo("Equipment", request.equipment_name);
  addInfo("Lab", request.lab_location);
  addInfo("Description", request.description);
  addInfo("Priority", makeBadge(request.priority, priorityBadgeClass[request.priority]));
  addInfo("Status", makeBadge(request.status, statusBadgeClass[request.status]));
  addInfo("Reported by", personName(request.reported_by));
  addInfo("Technician", request.assigned_to ? personName(request.assigned_to) : "Not assigned");
  addInfo("Reported on", formatDate(request.created_at));
  if (request.status === "Closed") {
    addInfo("Closed on", formatDate(request.closed_at));
    addInfo("Verified by", request.verified_by ? personName(request.verified_by) : "Administrator");
  }
  if (request.rework_reason) {
    addInfo("Rework reason", request.rework_reason);
  }

  renderActions(request);
}

// 10c. Actions card: only the buttons this role may use at this status.
// (The database checks every change again, so hiding buttons is for convenience, not security.)
function renderActions(request) {
  const role = currentUser.role;
  let actionCount = 0;

  // Technician: only on requests assigned to them
  if (role === "technician" && request.assigned_to === currentUser.id) {
    if (request.status === "Assigned") {
      addButtonAction("Start work", "Moves the request to In Progress.", "btn", function () {
        updateSelectedRequest({ status: "In Progress" }, "Work started. The status is now In Progress.");
      });
      actionCount++;
    }
    if (request.status === "In Progress") {
      addButtonAction("Mark as resolved", "The Lab In-charge will then verify the repair.", "btn btn-success", function () {
        updateSelectedRequest({ status: "Resolved" }, "Marked as resolved. Waiting for the Lab In-charge to verify.");
      });
      actionCount++;
    }
  }

  // Lab In-charge
  if (role === "incharge") {
    if (request.status === "Open" || request.status === "Assigned" || request.status === "In Progress") {
      addAssignAction(request);
      actionCount++;
    }
    if (request.status === "Resolved") {
      addButtonAction("Verify & close", "Confirms the repair works and closes the request.", "btn btn-success", function () {
        updateSelectedRequest({ status: "Closed" }, "Repair verified. The request is now Closed.");
      });
      addReasonAction("Reject fix", "Sends the work back to the technician (In Progress).", "Work sent back. The status is now In Progress.");
      actionCount++;
    }
    if (request.status === "Closed") {
      addReasonAction("Reopen request", "Use this if the fault has come back.", "Request reopened. The status is now In Progress.");
      actionCount++;
    }
  }

  if (actionCount === 0) {
    const note = document.createElement("p");
    note.className = "muted";
    if (role === "reporter") {
      note.textContent = "Reporters can view requests and add comments.";
    } else if (role === "technician") {
      note.textContent = "No status change is available. Technicians can only update requests assigned to them (Assigned → In Progress → Resolved).";
    } else {
      note.textContent = "No status change is available at this stage.";
    }
    detailsActions.appendChild(note);
  }
}

// One block with a title, a hint and a button
function addButtonAction(buttonText, hintText, buttonClass, onClick) {
  const block = document.createElement("div");
  block.className = "action-block";

  const hint = document.createElement("p");
  hint.className = "muted small";
  hint.textContent = hintText;

  const button = document.createElement("button");
  button.type = "button";
  button.className = buttonClass;
  button.textContent = buttonText;
  button.addEventListener("click", onClick);

  block.appendChild(hint);
  block.appendChild(button);
  detailsActions.appendChild(block);
}

// Assign / reassign: dropdown of real technicians only
function addAssignAction(request) {
  const block = document.createElement("div");
  block.className = "action-block";

  const label = document.createElement("label");
  label.textContent = request.assigned_to ? "Reassign to another technician" : "Assign a technician";
  label.htmlFor = "assign-select";

  if (technicians.length === 0) {
    const none = document.createElement("p");
    none.className = "muted small";
    none.textContent = "No technicians available. The administrator must give a user the Technician role in Supabase.";
    block.appendChild(label);
    block.appendChild(none);
    detailsActions.appendChild(block);
    return;
  }

  const select = document.createElement("select");
  select.id = "assign-select";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a technician…";
  select.appendChild(placeholder);

  let optionCount = 0;
  for (let i = 0; i < technicians.length; i++) {
    if (technicians[i].id === request.assigned_to) continue;   // already assigned to this one
    const option = document.createElement("option");
    option.value = technicians[i].id;
    option.textContent = technicians[i].full_name;
    select.appendChild(option);
    optionCount++;
  }

  const hint = document.createElement("p");
  hint.className = "muted small";
  hint.textContent = "The request becomes Assigned. Reassigning restarts the job at Assigned.";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn";
  button.textContent = request.assigned_to ? "Reassign" : "Assign";
  button.addEventListener("click", function () {
    if (select.value === "") {
      showMessage(detailsMessage, "Please choose a technician first.", "error");
      return;
    }
    const name = select.options[select.selectedIndex].textContent;
    updateSelectedRequest({ assigned_to: select.value }, "Assigned to " + name + ". The status is now Assigned.");
  });

  block.appendChild(label);
  if (optionCount === 0) {
    const none = document.createElement("p");
    none.className = "muted small";
    none.textContent = "There is no other technician to reassign to.";
    block.appendChild(none);
  } else {
    block.appendChild(select);
    block.appendChild(hint);
    block.appendChild(button);
  }
  detailsActions.appendChild(block);
}

// Reject fix / Reopen: a reason is required (at least 5 characters, like the database rule)
function addReasonAction(buttonText, hintText, successText) {
  const block = document.createElement("div");
  block.className = "action-block";

  const hint = document.createElement("p");
  hint.className = "muted small";
  hint.textContent = hintText;

  const reasonBox = document.createElement("textarea");
  reasonBox.rows = 2;
  reasonBox.maxLength = 500;
  reasonBox.placeholder = "Reason (required, at least 5 characters)";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-danger";
  button.textContent = buttonText;
  button.addEventListener("click", function () {
    const reason = reasonBox.value.trim();
    if (reason.length < 5) {
      showMessage(detailsMessage, "Please give a reason of at least 5 characters.", "error");
      return;
    }
    updateSelectedRequest({ status: "In Progress", rework_reason: reason }, successText);
  });

  block.appendChild(hint);
  block.appendChild(reasonBox);
  block.appendChild(button);
  detailsActions.appendChild(block);
}

// Disable every button/field in the Actions card while saving (no double clicks)
function setActionsDisabled(disabled) {
  const controls = detailsActions.querySelectorAll("button, select, textarea");
  for (let i = 0; i < controls.length; i++) {
    controls[i].disabled = disabled;
  }
}

// 10d. Send one change to Supabase. The database decides if it is allowed.
async function updateSelectedRequest(changes, successText) {
  hideMessage(detailsMessage);
  setActionsDisabled(true);

  const result = await supabaseClient
    .from("requests")
    .update(changes)
    .eq("id", selectedRequestId)
    .select("id");                         // ask for the changed row back

  if (result.error) {
    // Rejected by a database rule (trigger / constraint / privilege)
    showMessage(detailsMessage, "Not saved: " + result.error.message, "error");
    setActionsDisabled(false);
    return;
  }
  if (result.data.length === 0) {
    // Row Level Security silently skipped the row: this user may not change it
    showMessage(detailsMessage, "Not saved: you are not allowed to change this request.", "error");
    setActionsDisabled(false);
    return;
  }

  await refreshAllData();                  // dashboard, lists and reports
  renderDetails();                         // new status and buttons
  await loadHistory();                     // the trigger has added a history entry
  showMessage(detailsMessage, successText, "success");
}

// 10e. Comments
async function loadComments() {
  showListMessage(commentsList, "Loading comments…");

  const result = await supabaseClient
    .from("comments")
    .select("id, author_id, message, created_at")
    .eq("request_id", selectedRequestId)
    .order("created_at", { ascending: true });

  if (result.error) {
    showListMessage(commentsList, "Could not load comments: " + result.error.message);
    return;
  }
  if (result.data.length === 0) {
    showListMessage(commentsList, "No comments yet.");
    return;
  }

  commentsList.replaceChildren();
  for (let i = 0; i < result.data.length; i++) {
    const comment = result.data[i];
    const item = document.createElement("li");

    const meta = document.createElement("div");
    meta.className = "item-meta";
    const author = document.createElement("strong");
    author.textContent = comment.author_id ? personName(comment.author_id) : "Administrator";
    const time = document.createElement("span");
    time.textContent = formatDate(comment.created_at);
    meta.appendChild(author);
    meta.appendChild(time);

    const text = document.createElement("p");
    text.className = "item-text";
    text.textContent = comment.message;    // textContent: comment text can never run as code

    item.appendChild(meta);
    item.appendChild(text);
    commentsList.appendChild(item);
  }
}

commentForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  hideMessage(commentMessage);

  const message = commentText.value.trim();
  if (message.length === 0) {
    showMessage(commentMessage, "Please write a comment first.", "error");
    return;
  }

  commentButton.disabled = true;
  commentButton.textContent = "Adding…";

  // Only request_id and message are sent; the database sets author_id and created_at
  const result = await supabaseClient
    .from("comments")
    .insert({ request_id: selectedRequestId, message: message });

  commentButton.disabled = false;
  commentButton.textContent = "Add comment";

  if (result.error) {
    showMessage(commentMessage, "Could not add the comment: " + result.error.message, "error");
    return;
  }

  commentText.value = "";
  await loadComments();
  await loadHistory();
  showMessage(commentMessage, "Comment added.", "success");
});

// 10f. History (written only by database triggers; we only read it)
const sourceNames = {
  website: "website",
  simulated: "SQL test simulation",
  admin: "database administrator"
};

async function loadHistory() {
  showListMessage(historyList, "Loading history…");

  const result = await supabaseClient
    .from("history")
    .select("id, action, details, actor_id, source, created_at")
    .eq("request_id", selectedRequestId)
    .order("id", { ascending: true });

  if (result.error) {
    showListMessage(historyList, "Could not load history: " + result.error.message);
    return;
  }
  if (result.data.length === 0) {
    showListMessage(historyList, "No history recorded yet.");
    return;
  }

  historyList.replaceChildren();
  for (let i = 0; i < result.data.length; i++) {
    const entry = result.data[i];
    const item = document.createElement("li");

    const meta = document.createElement("div");
    meta.className = "item-meta";
    const action = document.createElement("strong");
    action.textContent = entry.action;
    const time = document.createElement("span");
    time.textContent = formatDate(entry.created_at);
    meta.appendChild(action);
    meta.appendChild(time);

    const details = document.createElement("p");
    details.className = "item-text";
    details.textContent = entry.details || "";

    const who = document.createElement("p");
    who.className = "muted small";
    const actor = entry.actor_id ? personName(entry.actor_id) : "Administrator";
    who.textContent = "By " + actor + " · via " + (sourceNames[entry.source] || entry.source);

    item.appendChild(meta);
    item.appendChild(details);
    item.appendChild(who);
    historyList.appendChild(item);
  }
}


// ---------- 11. START THE APP ----------
// Runs last, so every function and element above is ready.

startApp();
