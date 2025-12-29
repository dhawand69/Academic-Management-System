function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let icon = "✅";
  if (type === "error") icon = "❌";
  if (type === "info") icon = "ℹ️";

  toast.innerHTML = `<div>${icon}</div><div>${message}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showConfirm(message, actionCallback) {
  document.getElementById("confirmationMessage").textContent = message;
  pendingAction = actionCallback;
  openModal("confirmationModal");
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("show");
    modal.style.display = "flex";
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("show");
    modal.style.display = "none";
  }
}

function switchAdminTab(tabName) {
  document
    .querySelectorAll("#adminPanel .tab-content")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll("#adminPanel .tab-btn")
    .forEach((b) => b.classList.remove("active"));
  const tabId = "admin" + tabName.charAt(0).toUpperCase() + tabName.slice(1);
  document.getElementById(tabId).classList.add("active");
  event.target.classList.add("active");

  if (tabName === "attendanceHistory") {
    document.getElementById("adminAttendanceBody").innerHTML = `
                    <tr>
                        <td colspan="10" style="text-align:center; padding: 40px; color: gray;">
                            ⚙️ Set your filters and click "Load Attendance" to view data
                        </td>
                    </tr>
                `;
    document.getElementById("adminRecordCount").textContent = `(0)`;
    document.getElementById("yearWiseAttendanceSummary").innerHTML =
      '<p style="color: #999;">Click "Load Attendance" to generate summary</p>';

    document.getElementById("statTotalRecords").textContent = "0";
    document.getElementById("statAvgPercentage").textContent = "0%";
    document.getElementById("statAbove75").textContent = "0";
    document.getElementById("statBelow75").textContent = "0";
  }

  if (tabName === "bulkExport") {
    updateExportStats();
  }
}

function openBatchClassModal() {
  document.getElementById("batchClassModal").classList.add("show");
  document.getElementById("batchPreviewArea").style.display = "none";
  document
    .getElementById("batchPreviewTable")
    .querySelector("tbody").innerHTML = "";
  document.getElementById("batchClassInput").value = "";
}

function previewBatchClasses() {
  const input = document.getElementById("batchClassInput").value;
  const branch = document.getElementById("batchBranch").value;
  const year = document.getElementById("batchYear").value;

  const lines = input.split(/\r\n|\n|\r/);
  const tbody = document
    .getElementById("batchPreviewTable")
    .querySelector("tbody");
  tbody.innerHTML = "";
  parsedBatchClasses = [];

  lines.forEach((line) => {
    if (!line.trim()) return;
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length >= 4) {
      const cls = {
        semester: parseInt(parts[0]),
        name: parts[1],
        code: parts[2],
        faculty: parts[3],
        department: branch,
        year: parseInt(year),
        credits: 3,
        created_at: new Date().toISOString(),
      };
      parsedBatchClasses.push(cls);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${cls.semester}</td><td>${cls.name}</td><td>${cls.code}</td><td>${cls.faculty}</td>`;
      tbody.appendChild(tr);
    }
  });

  if (parsedBatchClasses.length > 0) {
    document.getElementById("batchPreviewArea").style.display = "block";
  } else {
    showToast(
      "No valid lines found. Format: Sem, Name, Code, Faculty",
      "error"
    );
  }
}

async function saveBatchClasses() {
  try {
    const allFaculty = await getAll("faculty");
    const existingFacultyNames = new Set(
      allFaculty.map((f) => `${f.firstName} ${f.lastName}`.toLowerCase().trim())
    );
    const newFacultyMap = new Map();

    parsedBatchClasses.forEach((cls) => {
      const facName = cls.faculty.trim();
      if (!facName) return;
      const facNameLower = facName.toLowerCase();

      if (
        !existingFacultyNames.has(facNameLower) &&
        !newFacultyMap.has(facNameLower)
      ) {
        const nameParts = facName.split(" ");
        let firstName = nameParts[0];
        let lastName = nameParts.slice(1).join(" ");
        if (!lastName) lastName = ".";

        let deducedDept = "";
        const subj = cls.name.toLowerCase();
        const code = cls.code.toLowerCase();

        if (subj.includes("security") || subj.includes("cyber"))
          deducedDept = "CSE(Cyber Security)";
        else if (subj.includes("network")) deducedDept = "CSE(Networks)";
        else if (
          subj.includes("computer") ||
          subj.includes("data") ||
          subj.includes("programming") ||
          subj.includes("algorithm") ||
          code.startsWith("cs")
        )
          deducedDept = "Computer Science";
        else if (
          subj.includes("civil") ||
          subj.includes("structure") ||
          subj.includes("concrete") ||
          code.startsWith("ce")
        )
          deducedDept = "Civil";
        else if (
          subj.includes("mech") ||
          subj.includes("thermo") ||
          subj.includes("fluid") ||
          code.startsWith("me")
        )
          deducedDept = "Mechanical";
        else if (
          subj.includes("electric") ||
          subj.includes("power") ||
          code.startsWith("ee")
        )
          deducedDept = "Electrical";
        else if (
          subj.includes("electronic") ||
          subj.includes("signal") ||
          subj.includes("digital") ||
          code.startsWith("ec")
        )
          deducedDept = "ECE";
        else if (
          subj.includes("physics") ||
          subj.includes("chemistry") ||
          subj.includes("math") ||
          subj.includes("english")
        )
          deducedDept = "Applied Science";
        else deducedDept = cls.department;

        const newFaculty = {
          facultyId: "",
          firstName: firstName,
          lastName: lastName,
          email: "N/A",
          department: deducedDept,
          specialization: cls.name,
          password: "pass123",
          created_at: new Date().toISOString(),
        };
        newFacultyMap.set(facNameLower, newFaculty);
      }
    });

    if (newFacultyMap.size > 0) {
      const facultyPromises = Array.from(newFacultyMap.values()).map((f) =>
        addRecord("faculty", f)
      );
      await Promise.all(facultyPromises);
      showToast(
        `Created ${newFacultyMap.size} new faculty profiles (Default Password: pass123)`,
        "info"
      );
      await loadFaculty();
    }

    const classPromises = parsedBatchClasses.map((cls) =>
      addRecord("classes", cls)
    );
    await Promise.all(classPromises);

    showToast(`Successfully created ${parsedBatchClasses.length} classes!`);
    closeModal("batchClassModal");
    loadClasses();
  } catch (e) {
    console.error(e);
    showToast("Error saving classes", "error");
  }
}

async function addStudent(event) {
  event.preventDefault();

  // Get form values using CORRECT input IDs (matching HTML)
  const rollNo = document.getElementById("studentRollNo").value;
  const firstName = document.getElementById("studentFirstName").value;
  const lastName = document.getElementById("studentLastName").value;
  const email = document.getElementById("studentEmail").value;
  const department = document.getElementById("studentDept").value;
  const year = parseInt(document.getElementById("studentYear").value);
  const semester = parseInt(document.getElementById("studentSemester").value);

  // Validation - ensure required fields are filled
  if (!rollNo || !firstName || !lastName || !department) {
    showToast("Please fill all required fields", "error");
    return;
  }

  try {
    // Add student to database with correct column names (all lowercase for Supabase)
    const newStudent = await addRecord("students", {
      rollno: rollNo, // ✅ lowercase - matches Supabase column
      firstname: firstName, // ✅ lowercase - matches Supabase column
      lastname: lastName, // ✅ lowercase - matches Supabase column
      email: email,
      department: department,
      year: year,
      semester: semester,
    });

    if (newStudent) {
      showToast(`Student ${firstName} added successfully!`, "success");

      // Clear the form fields
      document.getElementById("studentRollNo").value = "";
      document.getElementById("studentFirstName").value = "";
      document.getElementById("studentLastName").value = "";
      document.getElementById("studentEmail").value = "";
      document.getElementById("studentDept").value = "";
      document.getElementById("studentYear").value = "";
      document.getElementById("studentSemester").value = "";

      // Close modal
      closeModal("addUserModal");

      // Reload students list
      await loadStudents();
    } else {
      showToast("Failed to add student", "error");
    }
  } catch (error) {
    console.error("Error adding student:", error);
    showToast(`Error adding student: ${error.message}`, "error");
  }
}

function autoFillStudentDetails() {
  const regNo = document.getElementById("studentRollNo").value;
  if (regNo.length < 5) return;
  const yearCode = regNo.substring(0, 2);
  const branchCode = regNo.substring(2, 5);
  let isLateral = false;
  if (regNo.length >= 11) {
    const serial = parseInt(regNo.substring(8, 11));
    if (serial >= 901) isLateral = true;
  }
  let batchYear = 2000 + parseInt(yearCode);
  if (isLateral) batchYear += 1;
  const department = branchMap[branchCode];
  if (department) document.getElementById("studentDept").value = department;
  if (!isNaN(batchYear))
    document.getElementById("studentYear").value = batchYear;
}

async function loadStudents() {
  const allStudents = await getAll("students");
  const tbody = document.getElementById("usersTableBody");
  const bulkContainer = document.getElementById("bulkActionContainer");
  const countLabel = document.getElementById("studentCount");
  tbody.innerHTML = "";
  displayedStudents = allStudents.filter((student) => {
    if (activeStudentFilter.year !== "all") {
      const sem = student.semester;
      const expectedMinSem = (activeStudentFilter.year - 1) * 2 + 1;
      const expectedMaxSem = expectedMinSem + 1;
      if (sem < expectedMinSem || sem > expectedMaxSem) return false;
    }
    if (activeStudentFilter.semester !== null) {
      if (student.semester !== activeStudentFilter.semester) return false;
    }
    if (activeStudentFilter.branch !== "all") {
      if (student.department !== activeStudentFilter.branch) return false;
    }
    return true;
  });
  displayedStudents.forEach((student) => {
    const isSelected = selectedStudentIds.has(student.id);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><input type="checkbox" class="student-checkbox" value="${
      student.id
    }" onchange="handleCheckboxChange(this)" ${
      isSelected ? "checked" : ""
    }></td><td style="cursor: pointer; color: var(--color-primary);" onclick="viewStudentAttendance(${
      student.id
    }, '${student.rollno}', '${student.firstname} ${student.lastname}')">${
      student.rollno || ""
    }</td><td>${student.firstname || ""} ${student.lastname || ""}</td><td>${
      student.department || ""
    }</td><td>${
      student.year || ""
    }</td><td><span class="status-badge" style="background:#eaf6fd; color:#2c5282;">Sem ${
      student.semester || ""
    }</span></td><td><button class="btn btn-small btn-danger" onclick="deleteStudent(${
      student.id
    })">Delete</button></td>`;
    tbody.appendChild(tr);
  });
  countLabel.textContent = `(${displayedStudents.length})`;
  if (activeStudentFilter.year !== "all" && displayedStudents.length > 0) {
    bulkContainer.style.display = "flex";
  } else {
    bulkContainer.style.display = "none";
  }
  updateSelectionUI();
  updateDashboard();
}

async function deleteStudent(id) {
  showConfirm("Delete this student record permanently?", async function () {
    await deleteRecord("students", id);
    selectedStudentIds.delete(id);
    showToast("Student deleted successfully", "info");
    loadStudents();
  });
}

function promoteFilteredStudents() {
  const targets = getTargetStudents();
  if (targets.length === 0) {
    showToast("No students to promote!", "error");
    return;
  }
  const type = selectedStudentIds.size > 0 ? "SELECTED" : "LISTED";
  showConfirm(
    `Are you sure you want to promote these ${targets.length} ${type} students?`,
    async function () {
      let updatedCount = 0;
      for (const student of targets) {
        const newSem = student.semester + 1;
        student.semester = newSem > 8 ? 9 : newSem;
        student.year = Math.ceil(student.semester / 2);
        await updateRecord("students", student.id, student);
        updatedCount++;
      }
      showToast(`Promoted ${updatedCount} students!`);
      selectedStudentIds.clear();
      loadStudents();
    }
  );
}

function setBulkSemester() {
  const targets = getTargetStudents();
  if (targets.length === 0) {
    showToast("No students to update!", "error");
    return;
  }
  const targetSem = parseInt(document.getElementById("bulkSemSelect").value);
  showConfirm(
    `Move ${targets.length} students to Semester ${targetSem}?`,
    async function () {
      let updatedCount = 0;
      for (const student of targets) {
        student.semester = targetSem;
        student.year = Math.ceil(targetSem / 2);
        await updateRecord("students", student.id, student);
        updatedCount++;
      }
      showToast(`Updated ${updatedCount} students!`);
      selectedStudentIds.clear();
      loadStudents();
    }
  );
}

function deleteFilteredStudents() {
  const targets = getTargetStudents();
  if (targets.length === 0) {
    showToast("No students to delete!", "error");
    return;
  }
  showConfirm(
    `⚠️ DANGER: Permanently delete ${targets.length} students?`,
    async function () {
      const deletePromises = targets.map((student) =>
        deleteRecord("students", student.id)
      );
      await Promise.all(deletePromises);
      showToast(`Deleted ${targets.length} students!`, "success");
      selectedStudentIds.clear();
      loadStudents();
    }
  );
}

async function clearAllStudents() {
  showConfirm(
    "⚠️ EXTREME DANGER: Delete ALL students permanently?",
    async function () {
      const allStudents = await getAll("students");
      const deletePromises = allStudents.map((s) =>
        deleteRecord("students", s.id)
      );
      await Promise.all(deletePromises);
      showToast("All students deleted", "success");
      loadStudents();
    }
  );
}

async function addFaculty(event) {
  event.preventDefault();
  const faculty = {
    facultyId: document.getElementById("facultyId").value,
    password: document.getElementById("facultyPassword").value,
    firstName: document.getElementById("facultyFirstName").value,
    lastName: document.getElementById("facultyLastName").value,
    email: document.getElementById("facultyEmail").value || "N/A",
    department: document.getElementById("facultyDept").value,
    specialization: document.getElementById("facultySpecial").value || "N/A",
    created_at: new Date().toISOString(),
  };
  await addRecord("faculty", faculty);
  showToast("Faculty added successfully!");
  event.target.reset();
  closeModal("addFacultyModal");
  loadFaculty();
}

async function openEditFacultyModal(id) {
  const faculty = await getRecord("faculty", id);
  if (!faculty) return;
  document.getElementById("editFacultyIdKey").value = faculty.id;
  document.getElementById("editFacultyId").value = faculty.facultyid;
  document.getElementById("editFacultyFirstName").value = faculty.firstname;
  document.getElementById("editFacultyLastName").value = faculty.lastname;
  document.getElementById("editFacultyEmail").value = faculty.email;
  document.getElementById("editFacultyDept").value = faculty.department;
  document.getElementById("editFacultySpecial").value =
    faculty.specialization || "";
  document.getElementById("editFacultyPassword").value = "";

  const classes = await getAll("classes");
  const deptClasses = classes.filter(
    (c) => c.department === faculty.department
  );
  const container = document.getElementById("editFacultyClassesList");
  container.innerHTML = "";
  const facultyFullName = `${faculty.firstName} ${faculty.lastName}`;

  if (deptClasses.length === 0) {
    container.innerHTML =
      '<p style="color:#999;">No classes found for this department.</p>';
  } else {
    deptClasses.forEach((cls) => {
      const isAssigned = cls.faculty === facultyFullName;
      const div = document.createElement("div");
      div.className = "class-assign-item";
      div.innerHTML = `<input type="checkbox" name="assignedClasses" value="${
        cls.id
      }" ${isAssigned ? "checked" : ""}><span><strong>${cls.code}</strong><br>${
        cls.name
      } (Sem ${cls.semester})</span>`;
      container.appendChild(div);
    });
  }
  openModal("editFacultyModal");
}

async function updateFaculty(event) {
  event.preventDefault();
  const idKey = parseInt(document.getElementById("editFacultyIdKey").value);
  const oldFaculty = await getRecord("faculty", idKey);
  const oldName = `${oldFaculty.firstName} ${oldFaculty.lastName}`;
  const newFirstName = document.getElementById("editFacultyFirstName").value;
  const newLastName = document.getElementById("editFacultyLastName").value;
  const newFullName = `${newFirstName} ${newLastName}`;

  const updatedData = {
    facultyId: document.getElementById("editFacultyId").value,
    firstName: newFirstName,
    lastName: newLastName,
    email: document.getElementById("editFacultyEmail").value,
    department: document.getElementById("editFacultyDept").value,
    specialization: document.getElementById("editFacultySpecial").value,
    password:
      document.getElementById("editFacultyPassword").value ||
      oldFaculty.password,
    created_at: oldFaculty.created_at,
  };
  await updateRecord("faculty", idKey, updatedData);

  const checkboxes = document.querySelectorAll('input[name="assignedClasses"]');
  for (let cb of checkboxes) {
    const clsId = parseInt(cb.value);
    const clsRecord = await getRecord("classes", clsId);
    if (cb.checked) {
      clsRecord.faculty = newFullName;
      await updateRecord("classes", clsId, clsRecord);
    } else if (!cb.checked && clsRecord.faculty === oldName) {
      clsRecord.faculty = "";
      await updateRecord("classes", clsId, clsRecord);
    }
  }

  if (oldName !== newFullName) {
    const allClasses = await getAll("classes");
    for (let cls of allClasses) {
      if (cls.faculty === oldName) {
        cls.faculty = newFullName;
        await updateRecord("classes", cls.id, cls);
      }
    }
  }
  showToast("Faculty updated successfully!");
  closeModal("editFacultyModal");
  document.getElementById("facultyProfileModal").classList.remove("show");
  loadFaculty();
}

// =============================================
// FACULTY PROFILE FUNCTIONS
// =============================================

async function viewFacultyProfile(id) {
  // 1. Fetch Data
  const faculty = await getRecord("faculty", id);
  const classes = await getAll("classes");

  if (!faculty) {
    if (typeof showToast === "function")
      showToast("Faculty member not found", "error");
    return;
  }

  // 2. Prepare Name (Lowercase keys)
  const fullName = `${faculty.firstname} ${faculty.lastname}`;

  // 3. Find Assigned Classes
  const myClasses = classes.filter((c) => c.faculty === fullName);

  // 4. Build Class Table Rows
  let classRows = "";
  if (myClasses.length === 0) {
    classRows =
      '<tr><td colspan="4" style="text-align:center; color:gray;">No classes assigned.</td></tr>';
  } else {
    myClasses.forEach((cls) => {
      classRows += `<tr>
                      <td><strong>${cls.code}</strong></td>
                      <td>${cls.name}</td>
                      <td>${cls.semester}</td>
                      <td>${cls.year || "N/A"}</td>
                    </tr>`;
    });
  }

  // 5. Inject HTML into Modal
  const container = document.getElementById("facultyProfileContent");
  container.innerHTML = `
    <div class="profile-section">
        <h2 style="color:var(--color-primary); margin-bottom:5px;">${fullName}</h2>
        <span class="status-badge" style="background:#eaf6fd; color:#2c5282; font-size:14px;">
            ${faculty.facultyid}
        </span>
    </div>
    <div class="profile-info-grid">
        <div class="profile-info-item">
            <label>Department</label>
            <div>${faculty.department}</div>
        </div>
        <div class="profile-info-item">
            <label>Email</label>
            <div>${faculty.email || "N/A"}</div>
        </div>
        <div class="profile-info-item">
            <label>Specialization</label>
            <div>${faculty.specialization || "N/A"}</div>
        </div>
        <div class="profile-info-item">
            <label>Joined Date</label>
            <div>${
              faculty.createdat
                ? new Date(faculty.createdat).toLocaleDateString()
                : "N/A"
            }</div>
        </div>
    </div>
    <h3 style="margin-bottom:15px; font-size:18px; border-bottom:2px solid var(--color-light); padding-bottom:10px;">
        📚 Assigned Classes Workload
    </h3>
    <table>
        <thead>
            <tr><th>Code</th><th>Subject Name</th><th>Sem</th><th>Year</th></tr>
        </thead>
        <tbody>${classRows}</tbody>
    </table>
  `;

  // 6. Hook up the "Edit" button inside the modal
  const btn = document.getElementById("btnEditFacultyClasses");
  if (btn) {
    btn.onclick = function () {
      // Close profile modal first
      closeModal("facultyProfileModal");
      // Open edit modal
      if (typeof openEditFacultyModal === "function") {
        openEditFacultyModal(id);
      }
    };
  }

  // 7. Show Modal
  openModal("facultyProfileModal");
}

// ui.js - Fix for Faculty List
// ui.js - Fix for Faculty List
async function loadFaculty() {
  const allFaculty = await getAll("faculty");
  const classes = await getAll("classes");
  const tbody = document.getElementById("facultyTableBody");
  const filterBranch = document.getElementById("facultyBranchFilter").value;

  tbody.innerHTML = "";

  const filteredFaculty = allFaculty.filter((f) =>
    filterBranch === "all" ? true : f.department === filterBranch
  );

  filteredFaculty.forEach((fac) => {
    // FIX: Use lowercase keys (firstname, lastname)
    const fullName = `${fac.firstname} ${fac.lastname}`;

    // Count classes
    const myClasses = classes.filter((c) => c.faculty === fullName);

    const classBadges = myClasses
      .map(
        (c) =>
          `<span class="assigned-classes-badge">${c.code} (${c.semester})</span>`
      )
      .join("");

    const tr = document.createElement("tr");

    // FIX: Replaced <a href="#"> with <span onclick> to prevent URL sticking
    tr.innerHTML = `
        <td>${fac.facultyid}</td>
        <td>
            <span onclick="viewFacultyProfile(${fac.id})" 
                  style="cursor: pointer; color: var(--color-primary); font-weight: bold; text-decoration: none;">
                ${fullName}
            </span>
        </td>
        <td>${
          classBadges || '<span style="color:#999; font-size:11px;">None</span>'
        }</td>
        <td>${fac.department}</td>
        <td>${fac.specialization || "N/A"}</td>
        <td>
            <button class="btn btn-small btn-info" onclick="openEditFacultyModal(${
              fac.id
            })">Edit</button>
            <button class="btn btn-small btn-danger" onclick="deleteFaculty(${
              fac.id
            })">Delete</button>
        </td>`;

    tbody.appendChild(tr);
  });

  // Update dropdown for "Add Class" modal
  const select = document.getElementById("classFaculty");
  if (select) {
    select.innerHTML = '<option value="">-- Select Faculty --</option>';
    allFaculty.forEach((fac) => {
      const name = `${fac.firstname} ${fac.lastname}`;
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
  }

  if (typeof updateDashboard === "function") updateDashboard();
}

async function deleteFaculty(id) {
  showConfirm("Delete this faculty member?", async function () {
    await deleteRecord("faculty", id);
    showToast("Faculty deleted successfully", "info");
    loadFaculty();
  });
}

async function addClass(event) {
  event.preventDefault();
  const classData = {
    code: document.getElementById("classCode").value,
    name: document.getElementById("courseName").value,
    department: document.getElementById("classDept").value,
    semester: parseInt(document.getElementById("classSemester").value),
    faculty: document.getElementById("classFaculty").value,
    year: parseInt(document.getElementById("classYear").value),
    credits: parseInt(document.getElementById("classCredits").value),
    created_at: new Date().toISOString(),
  };
  await addRecord("classes", classData);
  showToast("Class added successfully!");
  event.target.reset();
  closeModal("addClassModal");
  loadClasses();
}

async function updateClass(event) {
  event.preventDefault();
  const id = parseInt(document.getElementById("editClassIdKey").value);
  const oldRecord = await getRecord("classes", id);
  const updatedData = {
    code: document.getElementById("editClassCode").value,
    name: document.getElementById("editCourseName").value,
    department: document.getElementById("editClassDept").value,
    semester: parseInt(document.getElementById("editClassSemester").value),
    faculty: document.getElementById("editClassFaculty").value,
    year: parseInt(document.getElementById("editClassYear").value),
    credits: parseInt(document.getElementById("editClassCredits").value),
    created_at: oldRecord ? oldRecord.created_at : new Date().toISOString(),
  };
  await updateRecord("classes", id, updatedData);
  showToast("Class updated successfully!");
  closeModal("editClassModal");
  loadClasses();
}

async function openEditClassModal(id) {
  const cls = await getRecord("classes", id);
  if (!cls) return;
  document.getElementById("editClassIdKey").value = cls.id;
  document.getElementById("editClassCode").value = cls.code;
  document.getElementById("editCourseName").value = cls.name;
  document.getElementById("editClassDept").value = cls.department;
  document.getElementById("editClassSemester").value = cls.semester;
  document.getElementById("editClassYear").value = cls.year;
  document.getElementById("editClassCredits").value = cls.credits;
  const allFaculty = await getAll("faculty");
  const select = document.getElementById("editClassFaculty");
  select.innerHTML = '<option value="">-- Select Faculty --</option>';
  allFaculty.forEach((fac) => {
    const name = `${fac.firstName} ${fac.lastName}`;
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (name === cls.faculty) opt.selected = true;
    select.appendChild(opt);
  });
  openModal("editClassModal");
}

async function loadClasses() {
  const allClasses = await getAll("classes");
  const tbody = document.getElementById("classesTableBody");
  const select = document.getElementById("facultyClassSelect");
  tbody.innerHTML = "";
  const displayedClasses = allClasses.filter((cls) => {
    if (activeClassFilter.year !== "all") {
      const expectedMinSem = (activeClassFilter.year - 1) * 2 + 1;
      const expectedMaxSem = expectedMinSem + 1;
      if (cls.semester < expectedMinSem || cls.semester > expectedMaxSem)
        return false;
    }
    if (activeClassFilter.semester !== null) {
      if (cls.semester !== activeClassFilter.semester) return false;
    }
    return true;
  });
  displayedClasses.forEach((cls) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${cls.code}</td><td>${cls.name}</td><td>${cls.department}</td><td>${cls.semester}</td><td>${cls.faculty}</td><td>${cls.year}</td><td>${cls.credits}</td><td><button class="btn btn-small btn-info" onclick="openEditClassModal(${cls.id})">Edit</button><button class="btn btn-small btn-danger" onclick="deleteClass(${cls.id})">Delete</button></td>`;
    tbody.appendChild(tr);
  });
  updateDashboard();
}

async function deleteClass(id) {
  showConfirm("Delete this class?", async function () {
    await deleteRecord("classes", id);
    showToast("Class deleted successfully", "info");
    loadClasses();
  });
}

async function updateDashboard() {
  const students = await getAll("students");
  const faculty = await getAll("faculty");
  const classes = await getAll("classes");
  document.getElementById("totalStudents").textContent = students.length;
  document.getElementById("totalFaculty").textContent = faculty.length;
  document.getElementById("totalClasses").textContent = classes.length;
  const activeYearsSet = new Set();
  students.forEach((student) => {
    if (student.semester) {
      const year = Math.ceil(student.semester / 2);
      activeYearsSet.add(year);
    }
  });
  document.getElementById("activeYears").textContent = activeYearsSet.size;
}

async function loadYears() {
  const years = await getAll("academic_years");
  const container = document.getElementById("yearsContainer");
  container.innerHTML = "";
  if (years.length === 0) {
    container.innerHTML =
      '<p style="color: var(--color-gray);">No academic years configured yet.</p>';
    return;
  }
  years.forEach((year) => {
    const div = document.createElement("div");
    div.className = "summary-box";
    div.innerHTML = `<strong>Year ${year.year_name}:</strong> ${year.start_date} to ${year.end_date}<button class="btn btn-small btn-danger" style="float: right;" onclick="deleteYear(${year.id})">Delete</button>`;
    container.appendChild(div);
  });
  updateDashboard();
}

async function deleteYear(id) {
  showConfirm("Delete this academic year?", async function () {
    await deleteRecord("academic_years", id);
    showToast("Academic year deleted successfully", "info");
    loadYears();
  });
}

async function addAcademicYear(event) {
  event.preventDefault();
  const year = {
    year_name: document.getElementById("academicYear").value,
    start_date: document.getElementById("yearStartDate").value,
    end_date: document.getElementById("yearEndDate").value,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  await addRecord("academic_years", year);
  showToast("Academic year added successfully!");
  event.target.reset();
  closeModal("addYearModal");
  loadYears();
}

async function addCustomSemester() {
  const year = document.getElementById("customYearInput").value;
  const semester = document.getElementById("customSemesterInput").value;
  if (!year || !semester) {
    showToast("Please fill all fields", "error");
    return;
  }
  const record = {
    year: parseInt(year),
    semester: parseInt(semester),
    type: "custom",
    created_at: new Date().toISOString(),
  };
  await addRecord("academic_years", record);
  showToast("Semester added successfully!");
  document.getElementById("customYearInput").value = "";
  document.getElementById("customSemesterInput").value = "";
  loadYears();
}

async function saveSettings(event) {
  event.preventDefault();
  showToast("Settings saved!");
}

async function updateExportStats() {
  const students = await getAll("students");
  const faculty = await getAll("faculty");
  const classes = await getAll("classes");

  document.getElementById("exportStudentCount").textContent = students.length;
  document.getElementById("exportFacultyCount").textContent = faculty.length;
  document.getElementById("exportClassCount").textContent = classes.length;
}

function toggleSelectAll() {
  const masterCheckbox = document.getElementById("masterCheckbox");
  const isChecked = masterCheckbox.checked;
  const checkboxes = document.querySelectorAll(".student-checkbox");
  checkboxes.forEach((cb) => {
    cb.checked = isChecked;
    const id = parseInt(cb.value);
    if (isChecked) {
      selectedStudentIds.add(id);
    } else {
      selectedStudentIds.delete(id);
    }
  });
  updateSelectionUI();
}

function selectAllListed() {
  displayedStudents.forEach((s) => selectedStudentIds.add(s.id));
  document
    .querySelectorAll(".student-checkbox")
    .forEach((cb) => (cb.checked = true));
  document.getElementById("masterCheckbox").checked = true;
  updateSelectionUI();
}

function getTargetStudents() {
  if (selectedStudentIds.size > 0) {
    return displayedStudents.filter((s) => selectedStudentIds.has(s.id));
  }
  return displayedStudents;
}

function filterStudents(year) {
  activeStudentFilter.year = year;
  activeStudentFilter.semester = null;
  selectedStudentIds.clear();
  document.getElementById("masterCheckbox").checked = false;
  const buttons = document.getElementById("yearFilterGroup").children;
  for (let btn of buttons) {
    btn.classList.remove("active");
  }
  event.target.classList.add("active");
  const semContainer = document.getElementById("semesterFilterGroup");
  const semButtons = document.getElementById("semesterButtons");
  semButtons.innerHTML = "";
  if (year === "all") {
    semContainer.style.display = "none";
  } else {
    semContainer.style.display = "block";
    const startSem = (year - 1) * 2 + 1;
    const endSem = startSem + 1;
    const allBtn = document.createElement("button");
    allBtn.className = "filter-btn active";
    allBtn.textContent = "All";
    allBtn.onclick = (e) => filterBySemester(null, e);
    semButtons.appendChild(allBtn);
    for (let i = startSem; i <= endSem; i++) {
      const btn = document.createElement("button");
      btn.className = "filter-btn";
      btn.textContent = `Sem ${i}`;
      btn.onclick = (e) => filterBySemester(i, e);
      semButtons.appendChild(btn);
    }
  }
  loadStudents();
}

function filterBySemester(sem, event) {
  activeStudentFilter.semester = sem;
  selectedStudentIds.clear();
  document.getElementById("masterCheckbox").checked = false;
  const buttons = document.getElementById("semesterButtons").children;
  for (let btn of buttons) {
    btn.classList.remove("active");
  }
  event.target.classList.add("active");
  loadStudents();
}

function filterByBranch(branch) {
  activeStudentFilter.branch = branch;
  selectedStudentIds.clear();
  document.getElementById("masterCheckbox").checked = false;
  loadStudents();
}

function filterClasses(year) {
  activeClassFilter.year = year;
  activeClassFilter.semester = null;
  const buttons = document.getElementById("classYearFilterGroup").children;
  for (let btn of buttons) {
    btn.classList.remove("active");
  }
  event.target.classList.add("active");
  const semContainer = document.getElementById("classSemesterFilterGroup");
  const semButtons = document.getElementById("classSemesterButtons");
  semButtons.innerHTML = "";
  if (year === "all") {
    semContainer.style.display = "none";
  } else {
    semContainer.style.display = "block";
    const startSem = (year - 1) * 2 + 1;
    const endSem = startSem + 1;
    const allBtn = document.createElement("button");
    allBtn.className = "filter-btn active";
    allBtn.textContent = "All";
    allBtn.onclick = (e) => filterClassesBySemester(null, e);
    semButtons.appendChild(allBtn);
    for (let i = startSem; i <= endSem; i++) {
      const btn = document.createElement("button");
      btn.className = "filter-btn";
      btn.textContent = `Sem ${i}`;
      btn.onclick = (e) => filterClassesBySemester(i, e);
      semButtons.appendChild(btn);
    }
  }
  loadClasses();
}

function filterClassesBySemester(sem, event) {
  activeClassFilter.semester = sem;
  const buttons = document.getElementById("classSemesterButtons").children;
  for (let btn of buttons) {
    btn.classList.remove("active");
  }
  event.target.classList.add("active");
  loadClasses();
}

function handleCheckboxChange(checkbox) {
  const studentId = parseInt(checkbox.value);
  if (checkbox.checked) {
    selectedStudentIds.add(studentId);
  } else {
    selectedStudentIds.delete(studentId);
    document.getElementById("masterCheckbox").checked = false;
  }
  updateSelectionUI();
}

function updateSelectionUI() {
  const banner = document.getElementById("selectAllBanner");
  const count = selectedStudentIds.size;
  const targets = document.querySelectorAll(".action-target-text");
  targets.forEach((el) => {
    if (count > 0) {
      el.textContent = `Selected (${count})`;
    } else {
      el.textContent = "All Listed";
    }
  });
  if (count >= 4 && count < displayedStudents.length) {
    banner.style.display = "flex";
    document.getElementById(
      "selectAllText"
    ).textContent = `You have selected ${count} students.`;
    document.getElementById("selectAllCount").textContent =
      displayedStudents.length;
  } else {
    banner.style.display = "none";
  }
}

function renderStudentCard(student, isChecked = false) {
  const grid = document.getElementById("studentGrid");
  if (document.getElementById(`student-card-${student.id}`)) {
    const checkbox = document.querySelector(
      `#student-card-${student.id} .attendance-checkbox`
    );
    if (checkbox) checkbox.checked = isChecked;
    return;
  }
  const div = document.createElement("div");
  div.id = `student-card-${student.id}`;
  div.className = "student-attendance-card";
  div.style.padding = "15px";
  div.style.background = "white";
  div.style.border = "1px solid #ddd";
  div.style.borderRadius = "8px";
  div.style.display = "flex";
  div.style.justifyContent = "space-between";
  div.style.alignItems = "center";

  div.innerHTML = `<div style="text-align:left;"><div style="font-weight:bold; color:var(--color-dark);">${
    student.firstname
  } ${
    student.lastname
  }</div><div style="font-size:12px; color:var(--color-gray);">${
    student.rollno
  }</div></div> ...<label class="attendance-toggle"><input type="checkbox" class="attendance-checkbox" value="${
    student.id
  }" ${
    isChecked ? "checked" : ""
  }><span class="toggle-label">Present</span></label>`;
  grid.appendChild(div);
}

window.onclick = function (event) {
  if (event.target.classList.contains("modal")) {
    event.target.classList.remove("show");
    event.target.style.display = "none";
  }

  if (event.target.classList.contains("close-btn")) {
    const modal = event.target.closest(".modal");
    if (modal) {
      modal.classList.remove("show");
      modal.style.display = "none";
    }
  }
};

// Add this to ui.js to fix the ReferenceError
function toggleDateRange() {
  const rangeInputs = document.getElementById("dateRangeInputs");
  const isRange = document.querySelector(
    'input[name="dateFilterType"][value="range"]'
  ).checked;

  if (rangeInputs) {
    rangeInputs.style.display = isRange ? "flex" : "none";
  }
}
