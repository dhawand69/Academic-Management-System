// auth.js - Login and Authentication Logic
// CORRECTED FOR LOWERCASE DATABASE COLUMNS
// UPDATED WITH SECURE ADMIN LOGIN (Supabase Auth)

// Switch Tabs (UI Only)
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

  // Clear error messages
  document.querySelectorAll(".alert-error").forEach((e) => {
    e.style.display = "none";
    e.textContent = "";
  });
}

// ==========================================
// 1. SECURE ADMIN LOGIN (Supabase Auth) - REPLACED FROM CODE 2
// ==========================================
async function handleAdminLogin(event) {
  event.preventDefault();

  const email = document.getElementById("adminEmail").value;
  const password = document.getElementById("adminPassword").value;
  const errorDiv = document.getElementById("adminLoginError");

  // UI Feedback
  const btn = event.target.querySelector("button");
  const originalText = btn.textContent;
  btn.textContent = "Verifying...";
  btn.disabled = true;

  try {
    // Authenticate with Supabase Auth
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) throw error;

    console.log("✅ Admin Secure Login Success");

    // Log user in app
    completeLogin("admin", {
      name: "Admin User",
      email: data.user.email,
      id: data.user.id,
    });
  } catch (err) {
    console.error("Login Failed:", err.message);
    errorDiv.textContent = "❌ Login failed: " + err.message;
    errorDiv.style.display = "block";
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// ==========================================
// 2. FACULTY LOGIN (Database Check) - UPDATED FROM CODE 2
// ==========================================
async function handleFacultyLogin(event) {
  event.preventDefault();
  const id = document.getElementById("loginFacultyId").value;
  const password = document.getElementById("loginFacultyPassword").value;
  const errorDiv = document.getElementById("facultyLoginError");

  // FIX: Using lowercase 'facultyid'
  const allFaculty = await getAll("faculty");
  const facultyMember = allFaculty.find((f) => f.facultyid === id);

  if (facultyMember) {
    const storedPassword = facultyMember.password || "password123";
    if (password === storedPassword) {
      completeLogin("faculty", {
        id: facultyMember.id,
        facultyid: facultyMember.facultyid,
        firstname: facultyMember.firstname,
        lastname: facultyMember.lastname,
        role: "faculty",
        email: facultyMember.email,
        department: facultyMember.department,
      });
    } else {
      errorDiv.textContent = "❌ Incorrect Password";
      errorDiv.style.display = "block";
    }
  } else {
    errorDiv.textContent = "❌ Faculty ID not found";
    errorDiv.style.display = "block";
  }
}

// ==========================================
// 3. STUDENT LOGIN (Database Check) - UPDATED FROM CODE 2
// ==========================================
// FIND THIS FUNCTION IN auth.js
// ==========================================
// STUDENT LOGIN (Secure Password Validation)
// ==========================================
async function handleStudentLogin(event) {
  event.preventDefault();

  const rollNo = document.getElementById("loginStudentId").value.trim();
  const password = document.getElementById("loginStudentPassword").value.trim();
  const errorDiv = document.getElementById("studentLoginError");

  if (errorDiv) errorDiv.style.display = "none";

  if (!password) {
    showToast("Please enter your password", "error");
    return;
  }

  try {
    const allStudents = await getAll("students");
    // Find student by roll number
    const student = allStudents.find((s) => s.rollno == rollNo);

    if (student) {
      // Check if the student has a password set (not a first-time user)
      if (!student.password) {
        showToast(
          "First-time user? Please click 'Get Password' below.",
          "info",
        );
        return;
      }

      // Validate credentials
      if (student.password === password) {
        // Successful Login
        if (!student.has_logged_in) {
          student.has_logged_in = true;
          await updateRecord("students", student);
        }

        completeLogin("student", student);
        showToast(`Welcome back, ${student.firstname}!`);
      } else {
        showToast("Invalid Registration Number or Password", "error");
      }
    } else {
      showToast("Student records not found", "error");
    }
  } catch (error) {
    console.error("Login Error:", error);
    showToast("Server error during login", "error");
  }
}

// ==========================================
// FIRST TIME STUDENT LOGIN FLOW
// ==========================================
async function handleFirstTimeLogin(event) {
  event.preventDefault();

  // Grab the Roll Number from the login input
  const rollNo = document.getElementById("loginStudentId").value.trim();

  // UI Message Elements
  const errorDiv = document.getElementById("studentLoginError");
  // Ensure you added the infoDiv to your HTML as discussed previously
  const infoDiv = document.getElementById("studentLoginInfo");

  // Reset messages
  if (errorDiv) errorDiv.style.display = "none";
  if (infoDiv) infoDiv.style.display = "none";

  if (!rollNo) {
    errorDiv.textContent =
      "❌ Please enter your Registration Number first to get your password.";
    errorDiv.style.display = "block";
    return;
  }

  // Update UI to show loading state
  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = "Generating & Sending...";
  btn.style.pointerEvents = "none";
  btn.style.opacity = "0.7";

  try {
    // 1. Fetch Student from Database
    const allStudents = await getAll("students");
    const student = allStudents.find((s) => s.rollno == rollNo);

    if (!student) {
      errorDiv.textContent = "❌ Student Roll No not found in the system.";
      errorDiv.style.display = "block";
      return;
    }

    // 2. Check if already logged in
    // 2. Check if already logged in
    if (student.has_logged_in) {
      errorDiv.textContent =
        "❌ You have already logged in before. Please enter your password above, or contact the Examination Department if you have lost it.";
      errorDiv.style.display = "block";
      return;
    }
    // 3. Ensure Email Exists
    if (!student.email) {
      errorDiv.textContent =
        "⚠️ Email not found. Please visit the examination department to update your email and get your password.";
      errorDiv.style.display = "block";
      return;
    }

    // 4. Generate and Save Password (if it doesn't exist yet)
    if (!student.password) {
      // Generates a random 8-character alphanumeric password
      const newPassword = Math.random().toString(36).slice(-8).toUpperCase();
      student.password = newPassword;

      // Save the newly generated password to Supabase
      await updateRecord("students", student);
    }

    // 5. Call the Vercel API Route to send the email securely
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: student.email,
        name: student.firstname,
        rollno: student.rollno,
        password: student.password,
      }),
    });

    const data = await response.json();

    // 6. Handle API Response
    if (!response.ok) {
      throw new Error(data.error || "Failed to send email via server.");
    }

    console.log("✅ Vercel API successfully dispatched the email!");

    // 7. Show Success Message
    if (infoDiv) {
      infoDiv.textContent = `✅ Your password has been sent to your registered email (${student.email}). Please check your inbox (or spam folder).`;
      infoDiv.style.display = "block";
    }
  } catch (error) {
    console.error("First time login error:", error);
    if (errorDiv) {
      errorDiv.textContent =
        "❌ An error occurred while sending the email. Please try again later.";
      errorDiv.style.display = "block";
    }
  } finally {
    // 8. Restore Button UI
    btn.textContent = originalText;
    btn.style.pointerEvents = "auto";
    btn.style.opacity = "1";
  }
}

// ==========================================
// COMPLETE LOGIN FUNCTION - MERGED FROM BOTH CODES
// ==========================================
function completeLogin(role, userData) {
  currentUser = { ...userData, role: role };

  // Save to Local Storage
  localStorage.setItem("currentUser", JSON.stringify(currentUser));
  localStorage.setItem("loginTime", Date.now().toString());

  // Update UI
  document.getElementById("loginOverlay").style.display = "none";
  document.getElementById("mainContainer").style.display = "block";

  // FIX: Using lowercase 'firstname' and 'lastname' for display
  const name =
    role === "admin"
      ? "Admin User"
      : `${userData.firstname || userData.firstName || ""} ${
          userData.lastname || userData.lastName || ""
        }`.trim();

  // Update header
  const nameDisplay =
    document.getElementById("loggedInUser") ||
    document.getElementById("userInfoName");
  const roleDisplay =
    document.getElementById("roleBadge") ||
    document.getElementById("userInfoRole");

  if (nameDisplay) nameDisplay.textContent = name;
  if (roleDisplay) roleDisplay.textContent = role.toUpperCase();

  // Show/hide password change button
  const passwordChangeBtn = document.getElementById("passwordChangeBtn");
  if (role === "admin" || role === "faculty") {
    passwordChangeBtn.style.display = "inline-block";
  } else {
    passwordChangeBtn.style.display = "none";
  }

  // Activate correct panel
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(role + "Panel").classList.add("active");

  // Load role-specific data
  if (role === "faculty") {
    if (typeof populateFacultyClassDropdown === "function")
      populateFacultyClassDropdown();
    if (typeof populateFacultyMarksDropdown === "function")
      populateFacultyMarksDropdown();
    setTimeout(addMultiSessionButton, 500);
  } else if (role === "student") {
    if (typeof populateStudentDashboard === "function")
      populateStudentDashboard(userData);
  } else if (role === "admin") {
    if (typeof populateFacultyClassDropdown === "function")
      populateFacultyClassDropdown();
    if (typeof populateFacultyMarksDropdown === "function")
      populateFacultyMarksDropdown();
    if (typeof populateAdminClassFilter === "function")
      populateAdminClassFilter("all", "all");
    if (typeof updateDashboard === "function") updateDashboard();
  }

  // Clear form fields
  document.getElementById("adminPassword").value = "";
  document.getElementById("adminEmail") &&
    (document.getElementById("adminEmail").value = "");
  document.getElementById("loginFacultyId").value = "";
  document.getElementById("loginFacultyPassword").value = "";
  document.getElementById("loginStudentId").value = "";

  showToast(`Welcome, ${name}!`, "success");
}

// ==========================================
// HANDLE LOGOUT - UPDATED FROM CODE 2
// ==========================================
async function handleLogout() {
  showConfirm("Are you sure you want to logout?", async function () {
    // Sign out from Supabase if it's an Admin
    if (currentUser && currentUser.role === "admin") {
      try {
        await supabaseClient.auth.signOut();
      } catch (error) {
        console.error("Supabase sign out error:", error);
      }
    }

    currentUser = null;
    localStorage.removeItem("currentUser");
    localStorage.removeItem("loginTime");

    document.getElementById("facultyClassSelect").innerHTML =
      '<option value="">-- Select a class --</option>';
    document.getElementById("studentGrid").innerHTML = "";
    document.getElementById("studentGridContainer").style.display = "none";

    document.getElementById("loginOverlay").style.display = "flex";
    document.getElementById("mainContainer").style.display = "none";

    showToast("Logged out successfully", "info");
  });
}

// ==========================================
// SESSION MANAGEMENT - UPDATED FROM CODE 2
// ==========================================
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 Minutes in milliseconds

async function checkSession() {
  const storedUser = localStorage.getItem("currentUser");
  const loginTime = localStorage.getItem("loginTime");

  if (storedUser && loginTime) {
    const now = Date.now();
    const timeElapsed = now - parseInt(loginTime);

    // Check for timeout
    if (timeElapsed > SESSION_TIMEOUT) {
      console.log("Session expired.");
      await handleLogout();
      showToast("Session expired. Please log in again.", "warning");
      return;
    }

    const user = JSON.parse(storedUser);

    // Security check for Admin only
    if (user.role === "admin") {
      try {
        const { data } = await supabaseClient.auth.getSession();
        if (!data.session) {
          console.log("Admin session expired.");
          await handleLogout();
          showToast("Admin session expired. Please log in again.", "warning");
          return;
        }
      } catch (error) {
        console.error("Session check error:", error);
        await handleLogout();
        return;
      }
    }

    // Refresh the timestamp to keep session alive while active
    localStorage.setItem("loginTime", now.toString());

    // Restore session
    currentUser = user;
    console.log("Restoring session for:", currentUser.role);

    // Re-initialize UI based on role
    updateUIForRole(currentUser.role);
  }
}

// ==========================================
// HELPER: UPDATE UI FOR ROLE - FROM CODE 1
// ==========================================
function updateUIForRole(role) {
  console.log("Initializing UI for role:", role);

  // 1. SELECTORS
  const loginSection =
    document.getElementById("loginOverlay") ||
    document.querySelector(".login-wrapper");
  const mainContainer = document.querySelector(".container");

  // Header Elements (Try ID first, then fallback to structure)
  let nameDisplay =
    document.getElementById("userInfoName") ||
    document.getElementById("loggedInUser");
  let roleDisplay =
    document.getElementById("userInfoRole") ||
    document.getElementById("roleBadge");

  // Fallback: If IDs are missing, try to find them by class/structure
  if (!nameDisplay) {
    const userInfoDiv = document.querySelector(".user-info");
    if (userInfoDiv) {
      nameDisplay = userInfoDiv.querySelector("div:first-child");
      roleDisplay = userInfoDiv.querySelector(".user-role-badge");
    }
  }

  // 2. TOGGLE VIEWS
  if (loginSection) loginSection.style.display = "none";
  if (mainContainer) mainContainer.style.display = "block";

  // 3. UPDATE HEADER TEXT
  if (nameDisplay && roleDisplay) {
    if (role === "admin") {
      nameDisplay.textContent = "Administrator";
      roleDisplay.textContent = "ADMIN";
    } else {
      // Get name safely
      const fName = currentUser.firstname || currentUser.firstName || "User";
      const lName = currentUser.lastname || currentUser.lastName || "";

      nameDisplay.textContent = `${fName} ${lName}`.trim();
      roleDisplay.textContent = role.toUpperCase();
    }
  } else {
    console.warn(
      "⚠️ Header elements not found. Please add id='userInfoName' to the name div in HTML.",
    );
  }

  // 4. ACTIVATE PANEL
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"));
  const panelId = `${role}Panel`;
  const targetPanel = document.getElementById(panelId);

  if (targetPanel) {
    targetPanel.classList.add("active");
  }

  // 5. LOAD DATA
  if (role === "admin" && typeof updateDashboard === "function")
    updateDashboard();
  else if (
    role === "faculty" &&
    typeof populateFacultyClassDropdown === "function"
  )
    populateFacultyClassDropdown();
  else if (role === "student" && typeof populateStudentDashboard === "function")
    populateStudentDashboard(currentUser);
}

// ==========================================
// PASSWORD CHANGE FUNCTIONS - FROM CODE 1 (UNCHANGED)
// ==========================================
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
      // For admin, we need to use Supabase Auth to change password
      showError("Admin password change requires Supabase Auth implementation");
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
    document.getElementById("resetFacultySelect").value,
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
      "success",
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
// UNIVERSAL LOGIN HANDLERS - FROM CODE 1 (KEPT FOR COMPATIBILITY)
// =============================================
async function handleLogin(event, role) {
  event.preventDefault();

  // 1. Grab the form that was just submitted
  const form = event.target;
  console.log(`Processing ${role} login...`);

  if (role === "admin") {
    // Use the new secure admin login
    await handleAdminLogin(event);
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

    const enteredId = idInput.value.trim();
    const enteredPass = passInput.value.trim();

    console.log(`Checking DB for Faculty ID: "${enteredId}"`);

    const allFaculty = await getAll("faculty");

    // FIX: Loose comparison + Case insensitive check for ID
    const faculty = allFaculty.find(
      (f) =>
        (String(f.facultyid).toLowerCase() === enteredId.toLowerCase() ||
          f.email === enteredId) &&
        f.password === enteredPass,
    );

    if (faculty) {
      completeLogin("faculty", faculty);
    } else {
      console.warn(
        "Match failed. Database has:",
        allFaculty.map((f) => f.facultyid),
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
        allStudents.slice(0, 5).map((s) => s.rollno),
      );
      showToast("Student Registration No. not found", "error");
    }
  }
}

// =============================================
// INITIALIZE SESSION CHECK ON LOAD
// =============================================
document.addEventListener("DOMContentLoaded", () => {
  // Wait slightly for DB to init, then check session
  setTimeout(checkSession, 500);
});

// =============================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// =============================================
window.handleAdminLogin = handleAdminLogin;
window.handleFacultyLogin = handleFacultyLogin;
window.handleStudentLogin = handleStudentLogin;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.switchLoginTab = switchLoginTab;
window.openPasswordChangeModal = openPasswordChangeModal;
window.handlePasswordChange = handlePasswordChange;
window.openFacultyPasswordResetModal = openFacultyPasswordResetModal;
window.resetFacultyPassword = resetFacultyPassword;
