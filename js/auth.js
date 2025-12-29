// auth.js - Login and Authentication Logic
// CORRECTED FOR LOWERCASE DATABASE COLUMNS

function switchLoginTab(role) {
  document
    .querySelectorAll(".login-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(`.login-tab[data-role="${role}"]`)
    .classList.add("active");
  document
    .querySelectorAll(".login-form")
    .forEach((f) => f.classList.remove("active"));
  document.getElementById(role + "LoginForm").classList.add("active");
  document.querySelectorAll(".alert-error").forEach((e) => {
    e.style.display = "none";
    e.textContent = "";
  });
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const password = document.getElementById("adminPassword").value;
  const errorDiv = document.getElementById("adminLoginError");
  if (password === ADMIN_PASSWORD) {
    completeLogin("admin", { name: "Admin User" });
  } else {
    errorDiv.textContent = "❌ Incorrect Admin Password";
    errorDiv.style.display = "block";
  }
}

async function handleFacultyLogin(event) {
  event.preventDefault();
  const id = document.getElementById("loginFacultyId").value;
  const password = document.getElementById("loginFacultyPassword").value;
  const errorDiv = document.getElementById("facultyLoginError");

  const allFaculty = await getAll("faculty");

  // FIX: Using lowercase 'facultyid'
  const facultyMember = allFaculty.find((f) => f.facultyid === id);

  if (facultyMember) {
    const storedPassword = facultyMember.password || "password123";
    if (password === storedPassword) {
      completeLogin("faculty", facultyMember);
    } else {
      errorDiv.textContent = "❌ Incorrect Password";
      errorDiv.style.display = "block";
    }
  } else {
    errorDiv.textContent = "❌ Faculty ID not found";
    errorDiv.style.display = "block";
  }
}

async function handleStudentLogin(event) {
  event.preventDefault();
  const rollNo = document.getElementById("loginStudentId").value;
  const errorDiv = document.getElementById("studentLoginError");

  const allStudents = await getAll("students");

  // FIX: Using lowercase 'rollno'
  const student = allStudents.find((s) => s.rollno === rollNo);

  if (student) {
    completeLogin("student", student);
  } else {
    errorDiv.textContent = "❌ Student Roll No not found";
    errorDiv.style.display = "block";
  }
}

function completeLogin(role, userData) {
  currentUser = { role, ...userData };
  document.getElementById("loginOverlay").style.display = "none";
  document.getElementById("mainContainer").style.display = "block";

  // FIX: Using lowercase 'firstname' and 'lastname'
  const name =
    role === "admin"
      ? "Admin User"
      : `${userData.firstname} ${userData.lastname}`;

  document.getElementById("loggedInUser").textContent = name;
  document.getElementById("roleBadge").textContent = role.toUpperCase();

  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"));

  const passwordChangeBtn = document.getElementById("passwordChangeBtn");
  if (role === "admin" || role === "faculty") {
    passwordChangeBtn.style.display = "inline-block";
  } else {
    passwordChangeBtn.style.display = "none";
  }
  document.getElementById(role + "Panel").classList.add("active");

  if (role === "faculty") {
    populateFacultyClassDropdown();
    setTimeout(addMultiSessionButton, 500);
  } else if (role === "student") {
    populateStudentDashboard(userData);
  } else if (role === "admin") {
    populateFacultyClassDropdown();
    populateAdminClassFilter("all", "all");
  }

  document.getElementById("adminPassword").value = "";
  document.getElementById("loginFacultyId").value = "";
  document.getElementById("loginFacultyPassword").value = "";
  document.getElementById("loginStudentId").value = "";
}

function handleLogout() {
  showConfirm("Are you sure you want to logout?", function () {
    currentUser = null;
    document.getElementById("facultyClassSelect").innerHTML =
      '<option value="">-- Select a class --</option>';
    document.getElementById("studentGrid").innerHTML = "";
    document.getElementById("studentGridContainer").style.display = "none";

    document.getElementById("loginOverlay").style.display = "flex";
    document.getElementById("mainContainer").style.display = "none";
    showToast("Logged out successfully", "info");
  });
}

// Password Change Functions
function openPasswordChangeModal() {
  document.getElementById("currentPassword").value = "";
  document.getElementById("newPassword").value = "";
  document.getElementById("confirmPassword").value = "";
  document.getElementById("passwordChangeError").style.display = "none";
  document.getElementById("passwordChangeError").textContent = "";

  openModal("passwordChangeModal");

  const newPasswordInput = document.getElementById("newPassword");
  newPasswordInput.addEventListener("input", checkPasswordStrength);
}

function checkPasswordStrength() {
  const password = document.getElementById("newPassword").value;
  const strengthDiv =
    document.getElementById("passwordStrength") ||
    createPasswordStrengthIndicator();

  if (password.length === 0) {
    strengthDiv.className = "password-strength";
    strengthDiv.querySelector(".password-strength-bar").style.width = "0%";
    return;
  }

  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  const strengthBar = strengthDiv.querySelector(".password-strength-bar");
  if (strength <= 1) {
    strengthDiv.className = "password-strength weak";
  } else if (strength <= 3) {
    strengthDiv.className = "password-strength medium";
  } else {
    strengthDiv.className = "password-strength strong";
  }
}

function createPasswordStrengthIndicator() {
  const formGroup = document
    .getElementById("newPassword")
    .closest(".form-group");
  const strengthDiv = document.createElement("div");
  strengthDiv.id = "passwordStrength";
  strengthDiv.className = "password-strength";
  strengthDiv.innerHTML = '<div class="password-strength-bar"></div>';
  formGroup.appendChild(strengthDiv);

  const hint = document.createElement("small");
  hint.className = "password-hint";
  hint.textContent =
    "Use at least 8 characters with uppercase, lowercase, numbers and symbols for strong password";
  formGroup.appendChild(hint);

  return strengthDiv;
}

async function handlePasswordChange(event) {
  event.preventDefault();

  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const errorDiv = document.getElementById("passwordChangeError");

  errorDiv.style.display = "none";
  errorDiv.textContent = "";

  if (!currentPassword) {
    showError("Current password is required");
    return;
  }

  if (newPassword.length < 6) {
    showError("New password must be at least 6 characters long");
    return;
  }

  if (newPassword !== confirmPassword) {
    showError("New passwords do not match");
    return;
  }

  try {
    if (currentUser.role === "admin") {
      if (currentPassword !== ADMIN_PASSWORD) {
        showError("Current admin password is incorrect");
        return;
      }
      showError("Admin password change requires server-side implementation");
      return;
    } else if (currentUser.role === "faculty") {
      const allFaculty = await getAll("faculty");
      const facultyMember = allFaculty.find((f) => f.id === currentUser.id);

      if (!facultyMember) {
        showError("Faculty member not found");
        return;
      }

      const storedPassword = facultyMember.password || "password123";
      if (currentPassword !== storedPassword) {
        showError("Current password is incorrect");
        return;
      }

      facultyMember.password = newPassword;
      await updateRecord("faculty", facultyMember);

      showToast("Password changed successfully!", "success");
      closeModal("passwordChangeModal");
    } else {
      showError("Password change not available for students");
    }
  } catch (error) {
    console.error("Password change error:", error);
    showError("An error occurred. Please try again.");
  }

  function showError(message) {
    errorDiv.textContent = "❌ " + message;
    errorDiv.style.display = "block";
  }
}

async function openFacultyPasswordResetModal() {
  if (currentUser.role !== "admin") {
    showToast("Only admin can reset faculty passwords", "error");
    return;
  }

  const select = document.getElementById("resetFacultySelect");
  select.innerHTML = '<option value="">-- Select Faculty --</option>';

  const allFaculty = await getAll("faculty");
  allFaculty.forEach((faculty) => {
    const option = document.createElement("option");
    option.value = faculty.id;
    // FIX: Using lowercase keys for display
    option.textContent = `${faculty.facultyid} - ${faculty.firstname} ${faculty.lastname} (${faculty.department})`;
    select.appendChild(option);
  });

  document.getElementById("resetFacultyPassword").value = "password123";
  document.getElementById("resetFacultyInfo").style.display = "none";

  openModal("facultyPasswordResetModal");
}

async function resetFacultyPassword() {
  const facultyId = parseInt(
    document.getElementById("resetFacultySelect").value
  );
  const newPassword = document.getElementById("resetFacultyPassword").value;

  if (!facultyId || !newPassword) {
    showToast("Please select faculty and enter new password", "error");
    return;
  }

  if (newPassword.length < 6) {
    showToast("Password must be at least 6 characters", "error");
    return;
  }

  try {
    const faculty = await getRecord("faculty", facultyId);
    if (!faculty) {
      showToast("Faculty not found", "error");
      return;
    }

    faculty.password = newPassword;
    await updateRecord("faculty", faculty);

    // FIX: Using lowercase keys for success message
    showToast(
      `Password reset for ${faculty.firstname} ${faculty.lastname}`,
      "success"
    );

    const infoDiv = document.getElementById("resetFacultyInfo");
    infoDiv.innerHTML = `✅ Password updated successfully!<br><strong>New Password:</strong> ${newPassword}<br><strong>Faculty ID:</strong> ${faculty.facultyid}`;
    infoDiv.style.display = "block";

    setTimeout(() => {
      document.getElementById("resetFacultySelect").value = "";
      document.getElementById("resetFacultyPassword").value = "password123";
      infoDiv.style.display = "none";
    }, 3000);
  } catch (error) {
    console.error("Password reset error:", error);
    showToast("Error resetting password", "error");
  }
}

// =============================================
// AUTHENTICATION MODULE (Fixed: Session Persistence)
// =============================================

const SESSION_TIMEOUT = 3 * 60 * 1000; // 30 Minutes in milliseconds

// Check if user is already logged in (Run on page load)
async function checkSession() {
  const storedUser = localStorage.getItem("currentUser");
  const loginTime = localStorage.getItem("loginTime");

  if (storedUser && loginTime) {
    const now = Date.now();
    const timeElapsed = now - parseInt(loginTime);

    // Check for timeout
    if (timeElapsed > SESSION_TIMEOUT) {
      console.log("Session expired.");
      handleLogout(); // Auto logout
      showToast("Session expired. Please log in again.", "warning");
    } else {
      // Restore session
      currentUser = JSON.parse(storedUser);
      console.log("Restoring session for:", currentUser.role);

      // Refresh the timestamp to keep session alive while active
      localStorage.setItem("loginTime", now.toString());

      // Re-initialize UI based on role
      updateUIForRole(currentUser.role);
    }
  }
}

// Handle Login (Admin, Faculty, Student)
// Handle Login (Fixed: Checks multiple common IDs to prevent crashes)
// Handle Login (Fixed: Finds inputs automatically inside the form)
async function handleLogin(event, role) {
  event.preventDefault();

  // 1. Grab the form that was just submitted
  const form = event.target;
  console.log(`Processing ${role} login...`);

  if (role === "admin") {
    const passwordField = form.querySelector('input[type="password"]');
    if (!passwordField) {
      showToast("Error: Password field not found", "error");
      return;
    }

    if (passwordField.value === ADMIN_PASSWORD) {
      completeLogin("admin", {
        role: "admin",
        firstname: "Admin",
        lastname: "User",
      });
    } else {
      showToast("Invalid Admin Password", "error");
    }
  } else if (role === "faculty") {
    // Find the first text input (ID) and first password input
    const idInput =
      form.querySelector('input[type="text"]') ||
      form.querySelector('input[type="email"]');
    const passInput = form.querySelector('input[type="password"]');

    if (!idInput || !passInput) {
      console.error("❌ Form Inputs missing. Found:", {
        id: idInput,
        pass: passInput,
      });
      showToast("Login Error: Missing input fields", "error");
      return;
    }

    const enteredId = idInput.value.trim(); // Removes accidental spaces
    const enteredPass = passInput.value.trim();

    // Debugging: Show what we are looking for (Check Console F12)
    console.log(`Checking DB for Faculty ID: "${enteredId}"`);

    const allFaculty = await getAll("faculty");

    // FIX: Loose comparison + Case insensitive check for ID
    const faculty = allFaculty.find(
      (f) =>
        (String(f.facultyid).toLowerCase() === enteredId.toLowerCase() ||
          f.email === enteredId) &&
        f.password === enteredPass
    );

    if (faculty) {
      completeLogin("faculty", faculty);
    } else {
      console.warn(
        "Match failed. Database has:",
        allFaculty.map((f) => f.facultyid)
      );
      showToast("Invalid Credentials (ID or Password incorrect)", "error");
    }
  } else if (role === "student") {
    // Find the registration input
    const regInput =
      form.querySelector('input[type="text"]') ||
      form.querySelector('input[type="number"]');

    if (!regInput) {
      console.error("❌ Student Input missing inside form:", form);
      showToast("Login Error: Registration field not found", "error");
      return;
    }

    const enteredRoll = regInput.value.trim();
    console.log(`Checking DB for Student Roll: "${enteredRoll}"`);

    const allStudents = await getAll("students");

    // FIX: Loose comparison for Roll No
    const student = allStudents.find((s) => s.rollno == enteredRoll);

    if (student) {
      completeLogin("student", student);
    } else {
      console.warn(
        "Student not found. DB Roll Nos:",
        allStudents.slice(0, 5).map((s) => s.rollno)
      );
      showToast("Student Registration No. not found", "error");
    }
  }
}

// Complete Login & Save to Storage
function completeLogin(role, userData) {
  currentUser = { ...userData, role: role };

  // 1. Save to Local Storage
  localStorage.setItem("currentUser", JSON.stringify(currentUser));
  localStorage.setItem("loginTime", Date.now().toString());

  updateUIForRole(role);
  showToast(`Welcome, ${currentUser.firstname || "User"}!`, "success");
}

// Helper: Updates UI based on Role
// Helper: Updates UI based on Role (Fixed: Prevents Crashes)
// Helper: Updates UI based on Role (Fixed: Robust Selector)
function updateUIForRole(role) {
  console.log("Initializing UI for role:", role);

  // 1. SMART SELECTORS (Try ID first, then Class)
  const loginSection =
    document.getElementById("loginSection") ||
    document.querySelector(".login-wrapper");
  const mainContainer = document.querySelector(".container");
  const nameDisplay = document.getElementById("userInfoName");
  const roleDisplay = document.getElementById("userInfoRole");

  // 2. Hide Login Screen (Safely)
  if (loginSection) {
    loginSection.style.display = "none";
  } else {
    console.error(
      "CRITICAL ERROR: Could not find Login Screen. Checked id='loginSection' and class='.login-wrapper'"
    );
  }

  // 3. Show Dashboard (Safely)
  if (mainContainer) {
    mainContainer.style.display = "block";
  } else {
    console.error("⚠️ Error: Element class='container' not found in HTML");
  }

  // 4. Update Navbar Info
  const userName =
    currentUser.role === "admin"
      ? "Administrator"
      : `${currentUser.firstname} ${currentUser.lastname}`;

  if (nameDisplay) nameDisplay.textContent = userName;
  if (roleDisplay) roleDisplay.textContent = role.toUpperCase();

  // 5. Hide all panels first
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"));

  // 6. Show appropriate panel
  const panelId = `${role}Panel`; // e.g., adminPanel
  const targetPanel = document.getElementById(panelId);

  if (targetPanel) {
    targetPanel.classList.add("active");
  } else {
    console.error(`⚠️ Error: Panel id='${panelId}' not found in HTML`);
  }

  // 7. Run Role-Specific Functions
  if (role === "admin") {
    if (typeof updateDashboard === "function") updateDashboard();
  } else if (role === "faculty") {
    if (typeof populateFacultyClassDropdown === "function")
      populateFacultyClassDropdown();
  } else if (role === "student") {
    if (typeof populateStudentDashboard === "function")
      populateStudentDashboard(currentUser);
  }
}

// Handle Logout
// Handle Logout (Fixed: Safety Checks)
function handleLogout() {
  currentUser = null;

  // Clear Local Storage
  localStorage.removeItem("currentUser");
  localStorage.removeItem("loginTime");

  // 1. Reset UI - Find elements robustly
  const loginSection =
    document.getElementById("loginSection") ||
    document.querySelector(".login-wrapper");
  const mainContainer = document.querySelector(".container");

  if (mainContainer) {
    mainContainer.style.display = "none";
  }

  if (loginSection) {
    // Restore login screen style
    loginSection.style.display = "flex";
  } else {
    console.error("Logout Error: Cannot find Login Screen to restore.");
    // Fallback: Reload page to force login screen
    window.location.reload();
    return;
  }

  // Reset Forms
  document.querySelectorAll("form").forEach((f) => f.reset());

  showToast("Logged out successfully", "info");
}

// Initialize Session Check on Load
document.addEventListener("DOMContentLoaded", () => {
  // Wait slightly for DB to init, then check session
  setTimeout(checkSession, 500);
});

// Expose functions to global scope for HTML onclick events
window.handleAdminLogin = (e) => handleLogin(e, "admin");
window.handleFacultyLogin = (e) => handleLogin(e, "faculty");
window.handleStudentLogin = (e) => handleLogin(e, "student");
window.handleLogout = handleLogout;
