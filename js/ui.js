let showArchivedClasses = false;

if (typeof activeClassFilter === "undefined") {
  window.activeClassFilter = { year: "all", semester: null };
}
if (typeof activeStudentFilter === "undefined") {
  window.activeStudentFilter = { year: "all", branch: "all", semester: null };
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  let icon = type === "error" ? "❌" : type === "info" ? "ℹ️" : "✅";
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
  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add("active");
  if (event && event.target) event.target.classList.add("active");

  if (tabName === "attendanceHistory") {
    document.getElementById("adminAttendanceBody").innerHTML =
      `<tr><td colspan="10" style="text-align:center;">⚙️ Set filters to view data</td></tr>`;
  }
  if (tabName === "bulkExport" && typeof updateExportStats === "function") {
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
      "error",
    );
  }
}

async function saveBatchClasses() {
  try {
    const allFaculty = await getAll("faculty");
    const existingFacultyNames = new Set(
      allFaculty.map((f) =>
        `${f.firstName} ${f.lastName}`.toLowerCase().trim(),
      ),
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
        addRecord("faculty", f),
      );
      await Promise.all(facultyPromises);
      showToast(
        `Created ${newFacultyMap.size} new faculty profiles (Default Password: pass123)`,
        "info",
      );
      await loadFaculty();
    }

    const classPromises = parsedBatchClasses.map((cls) =>
      addRecord("classes", cls),
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
  const rollNo = document.getElementById("studentRollNo").value;
  const firstName = document.getElementById("studentFirstName").value;
  const lastName = document.getElementById("studentLastName").value;
  const email = document.getElementById("studentEmail").value;
  const department = document.getElementById("studentDept").value;
  const year = parseInt(document.getElementById("studentYear").value);
  const semester = parseInt(document.getElementById("studentSemester").value);

  const newStudent = await addRecord("students", {
    rollno: rollNo,
    firstname: firstName,
    lastname: lastName,
    email: email,
    department: department,
    year: year,
    semester: semester,
  });

  if (newStudent) {
    showToast(`Student added!`, "success");
    closeModal("addUserModal");
    event.target.reset();
    loadStudents();
  } else {
    showToast("Failed to add student", "error");
  }
}

function autoFillStudentDetails() {
  const regNo = document.getElementById("studentRollNo").value;
  if (regNo.length < 5) return;
  const yearCode = regNo.substring(0, 2);
  const branchCode = regNo.substring(2, 5);
  let batchYear = 2000 + parseInt(yearCode);

  if (regNo.length >= 11 && parseInt(regNo.substring(8, 11)) >= 901)
    batchYear += 1;
  if (!isNaN(batchYear))
    document.getElementById("studentYear").value = batchYear;

  if (typeof branchMap !== "undefined" && branchMap[branchCode]) {
    document.getElementById("studentDept").value = branchMap[branchCode];
  }
}

// Load Students Table (Fixed: Logic Bug Solved)
// FIXED loadStudents: Adds Roll No Sorting + Fixes "0 Students" bug
async function loadStudents() {
  const allStudents = await getAll("students");
  const tbody = document.getElementById("usersTableBody");
  const countLabel = document.getElementById("studentCount");
  const bulkContainer = document.getElementById("bulkActionContainer");

  tbody.innerHTML = "";

  const displayedStudents = allStudents.filter((student) => {
    const sem = parseInt(student.semester) || 1;
    const year = Math.ceil(sem / 2);

    if (activeStudentFilter.year !== "all" && year != activeStudentFilter.year)
      return false;
    if (
      activeStudentFilter.semester !== null &&
      sem != activeStudentFilter.semester
    )
      return false;
    if (activeStudentFilter.branch !== "all") {
      const sDept = (student.department || "").toLowerCase().trim();
      const fDept = activeStudentFilter.branch.toLowerCase().trim();
      if (!sDept.includes(fDept) && !fDept.includes(sDept)) return false;
    }
    return true;
  });

  // Sort
  displayedStudents.sort((a, b) => {
    const rA = String(a.rollno || a.rollNo || "").trim();
    const rB = String(b.rollno || b.rollNo || "").trim();
    return rA.localeCompare(rB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  if (displayedStudents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#999;">No students found matching filters.</td></tr>`;
    if (bulkContainer) bulkContainer.style.display = "none";
  } else {
    displayedStudents.forEach((student) => {
      const isSelected = selectedStudentIds.has(student.id);
      const tr = document.createElement("tr");
      const fName = student.firstname || student.firstName || "";
      const lName = student.lastname || student.lastName || "";
      const fullName = `${fName} ${lName}`.trim();
      const roll = student.rollno || student.rollNo || "N/A";

      tr.innerHTML = `
            <td><input type="checkbox" class="student-checkbox" value="${
              student.id
            }" onchange="handleCheckboxChange(this)" ${
              isSelected ? "checked" : ""
            }></td>
            <td style="cursor: pointer; color: var(--color-primary); font-weight:bold;" onclick="viewStudentAttendance(${
              student.id
            })">${roll}</td>
            <td>${fullName || "<span style='color:red'>No Name</span>"}</td>
            <td>${student.department || "-"}</td>
            <td>${Math.ceil((student.semester || 1) / 2)}</td>
            <td><span class="status-badge" style="background:#eaf6fd; color:#2c5282;">Sem ${
              student.semester || "1"
            }</span></td>
            <td>
                <button class="btn btn-small btn-info" onclick="openEditStudentModal(${
                  student.id
                })">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteStudent(${
                  student.id
                })">Delete</button>
            </td>`;
      tbody.appendChild(tr);
    });
    if (bulkContainer) bulkContainer.style.display = "flex";
  }

  if (countLabel) countLabel.textContent = `(${displayedStudents.length})`;
  if (typeof updateSelectionUI === "function") updateSelectionUI();
}
async function deleteStudent(id) {
  showConfirm("Delete this student?", async function () {
    await deleteRecord("students", id);
    selectedStudentIds.delete(id);
    showToast("Student deleted", "info");
    loadStudents();
  });
}

function filterStudents(year) {
  activeStudentFilter.year = year;
  activeStudentFilter.semester = null;
  if (typeof selectedStudentIds !== "undefined") selectedStudentIds.clear();

  // 1. Update Year Buttons
  const group = document.getElementById("yearFilterGroup");
  if (group) {
    for (let btn of group.children) btn.classList.remove("active");
    if (event && event.target) event.target.classList.add("active");
  }

  // 2. Generate Semester Buttons
  const semContainer = document.getElementById("semesterFilterGroup");
  const semButtons = document.getElementById("semesterButtons");

  if (semContainer && semButtons) {
    semButtons.innerHTML = "";

    if (year === "all") {
      semContainer.style.display = "none";
    } else {
      semContainer.style.display = "block";
      // Logic: Year 1->1,2 | Year 2->3,4
      const startSem = (year - 1) * 2 + 1;
      const endSem = startSem + 1;

      // "All" Button
      const allBtn = document.createElement("button");
      allBtn.className = "filter-btn active";
      allBtn.textContent = "All";
      allBtn.onclick = (e) => filterBySemester(null, e);
      semButtons.appendChild(allBtn);

      // Sem Buttons
      for (let i = startSem; i <= endSem; i++) {
        const btn = document.createElement("button");
        btn.className = "filter-btn";
        btn.textContent = `Sem ${i}`;
        btn.onclick = (e) => filterBySemester(i, e);
        semButtons.appendChild(btn);
      }
    }
  }
  loadStudents();
}

function filterBySemester(sem, event) {
  activeStudentFilter.semester = sem;
  if (typeof selectedStudentIds !== "undefined") selectedStudentIds.clear();

  const semButtons = document.getElementById("semesterButtons");
  if (semButtons) {
    for (let btn of semButtons.children) btn.classList.remove("active");
    if (event && event.target) event.target.classList.add("active");
  }
  loadStudents();
}

function filterByBranch(branch) {
  activeStudentFilter.branch = branch;
  selectedStudentIds.clear();
  document.getElementById("masterCheckbox").checked = false;
  loadStudents();
}

function promoteFilteredStudents() {
  // Get the currently filtered students directly from the table
  const tableBody = document.getElementById("usersTableBody");

  // Check if there's a "no students" message
  if (tableBody.innerHTML.includes("No students found")) {
    showToast("No students to promote!", "warning");
    return;
  }

  // Get all student rows (excluding the header)
  const studentRows = tableBody.querySelectorAll("tr");

  // Check if we should use only selected checkboxes or all visible rows
  const checkboxes = document.querySelectorAll(".student-checkbox:checked");
  let targets = [];

  if (checkboxes.length > 0) {
    console.log(`[DEBUG] Using ${checkboxes.length} selected students`);

    // Use only checked checkboxes
    checkboxes.forEach((cb) => {
      const studentId = parseInt(cb.value);
      const row = cb.closest("tr");
      if (row) {
        const cells = row.querySelectorAll("td");
        // Get semester from the 6th cell (index 5) which contains "Sem X"
        const semesterCell = cells[5];
        if (semesterCell) {
          const semesterText = semesterCell.textContent.trim();
          const semesterMatch = semesterText.match(/Sem\s*(\d+)/);
          const semester = semesterMatch ? parseInt(semesterMatch[1]) : 1;
          const year = Math.ceil(semester / 2);

          targets.push({
            id: studentId,
            semester: semester,
            year: year,
          });
        }
      }
    });
  } else {
    console.log(`[DEBUG] Using all ${studentRows.length} visible students`);

    // Use all visible rows
    studentRows.forEach((row) => {
      const checkbox = row.querySelector(".student-checkbox");
      if (checkbox) {
        const studentId = parseInt(checkbox.value);
        const cells = row.querySelectorAll("td");
        const semesterCell = cells[5];
        if (semesterCell) {
          const semesterText = semesterCell.textContent.trim();
          const semesterMatch = semesterText.match(/Sem\s*(\d+)/);
          const semester = semesterMatch ? parseInt(semesterMatch[1]) : 1;
          const year = Math.ceil(semester / 2);

          targets.push({
            id: studentId,
            semester: semester,
            year: year,
          });
        }
      }
    });
  }

  if (targets.length === 0) {
    showToast("No students to promote!", "warning");
    return;
  }

  console.log(`[DEBUG] Promoting ${targets.length} students`);

  // Show confirmation dialog
  showConfirm(
    `Promote ${targets.length} students to the next Semester?`,
    async function () {
      let success = 0;
      let fail = 0;

      for (const student of targets) {
        const currentSem = parseInt(student.semester) || 0;
        let nextSem = currentSem + 1;
        if (nextSem > 8) nextSem = 8;
        const nextYear = Math.ceil(nextSem / 2);

        console.log(
          `[DEBUG] Updating student ${student.id}: Sem ${currentSem} → Sem ${nextSem}, Year ${nextYear}`,
        );

        const result = await updateRecord("students", {
          id: student.id,
          semester: nextSem,
          year: nextYear,
        });

        if (result) {
          success++;
          console.log(`[DEBUG] Successfully updated student ${student.id}`);
        } else {
          fail++;
          console.log(`[DEBUG] Failed to update student ${student.id}`);
        }
      }

      showToast(
        `Operation Complete: ${success} Updated, ${fail} Failed`,
        fail > 0 ? "warning" : "success",
      );

      // Refresh the student list
      await loadStudents();

      // Clear selections
      if (selectedStudentIds) selectedStudentIds.clear();
      const masterCheckbox = document.getElementById("masterCheckbox");
      if (masterCheckbox) masterCheckbox.checked = false;
    },
  );
}
function setBulkSemester() {
  // A. Validation
  const dropdown = document.getElementById("bulkSemSelect");
  if (!dropdown || !dropdown.value) {
    showToast("Please select a semester first.", "error");
    return;
  }
  const targetSem = parseInt(dropdown.value);

  // Get current table rows
  const tableBody = document.getElementById("usersTableBody");
  const studentRows = tableBody.querySelectorAll("tr");

  // Check for selected checkboxes
  const checkboxes = document.querySelectorAll(".student-checkbox:checked");
  let targets = [];

  if (checkboxes.length > 0) {
    console.log(
      `[DEBUG] Using ${checkboxes.length} selected students for bulk update`,
    );

    checkboxes.forEach((cb) => {
      const studentId = parseInt(cb.value);
      const row = cb.closest("tr");
      if (row) {
        targets.push({
          id: studentId,
        });
      }
    });
  } else {
    console.log(
      `[DEBUG] Using all ${studentRows.length} visible students for bulk update`,
    );

    studentRows.forEach((row) => {
      const checkbox = row.querySelector(".student-checkbox");
      if (checkbox) {
        const studentId = parseInt(checkbox.value);
        targets.push({
          id: studentId,
        });
      }
    });
  }

  if (targets.length === 0) {
    showToast("No students selected.", "warning");
    return;
  }

  // C. Trigger Confirmation
  showConfirm(
    `Move ${targets.length} students directly to Semester ${targetSem}?`,
    async function () {
      let successCount = 0;
      const targetYear = Math.ceil(targetSem / 2);

      for (const student of targets) {
        const result = await updateRecord("students", {
          id: student.id,
          semester: targetSem,
          year: targetYear,
        });

        if (result) successCount++;
      }

      showToast(
        `Updated ${successCount} students to Semester ${targetSem}`,
        "success",
      );

      await loadStudents();
      if (selectedStudentIds) selectedStudentIds.clear();
      document.getElementById("masterCheckbox").checked = false;
    },
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
        deleteRecord("students", student.id),
      );
      await Promise.all(deletePromises);
      showToast(`Deleted ${targets.length} students!`, "success");
      selectedStudentIds.clear();
      loadStudents();
    },
  );
}

async function clearAllStudents() {
  showConfirm(
    "⚠️ EXTREME DANGER: Delete ALL students permanently?",
    async function () {
      const allStudents = await getAll("students");
      const deletePromises = allStudents.map((s) =>
        deleteRecord("students", s.id),
      );
      await Promise.all(deletePromises);
      showToast("All students deleted", "success");
      loadStudents();
    },
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

  // FIX: Filter out archived classes so they don't appear in the assignment list
  const deptClasses = classes.filter(
    (c) => c.department === faculty.department && c.is_active !== false,
  );

  const container = document.getElementById("editFacultyClassesList");
  container.innerHTML = "";
  const facultyFullName = `${faculty.firstname} ${faculty.lastname}`;

  if (deptClasses.length === 0) {
    container.innerHTML = "<p>No active classes found.</p>";
  } else {
    deptClasses.forEach((cls) => {
      const isAssigned = cls.faculty === facultyFullName;
      const div = document.createElement("div");
      div.className = "class-assign-item";
      div.innerHTML = `<input type="checkbox" name="assignedClasses" value="${
        cls.id
      }" ${isAssigned ? "checked" : ""}><span><strong>${cls.code}</strong> (${
        cls.name
      })</span>`;
      container.appendChild(div);
    });
  }
  openModal("editFacultyModal");
}
async function updateFaculty(event) {
  event.preventDefault();
  const idKey = parseInt(document.getElementById("editFacultyIdKey").value);
  const oldFaculty = await getRecord("faculty", idKey);

  const newFirstName = document.getElementById("editFacultyFirstName").value;
  const newLastName = document.getElementById("editFacultyLastName").value;
  const newFullName = `${newFirstName} ${newLastName}`;

  const updatedData = {
    id: idKey,
    facultyId: document.getElementById("editFacultyId").value,
    firstName: newFirstName,
    lastName: newLastName,
    email: document.getElementById("editFacultyEmail").value,
    department: document.getElementById("editFacultyDept").value,
    specialization: document.getElementById("editFacultySpecial").value,
    password:
      document.getElementById("editFacultyPassword").value ||
      oldFaculty.password,
    createdat: oldFaculty.createdat || oldFaculty.created_at,
    updatedat: new Date().toISOString(),
  };

  await updateRecord("faculty", updatedData);

  const oldName = `${oldFaculty.firstname} ${oldFaculty.lastname}`;
  const checkboxes = document.querySelectorAll('input[name="assignedClasses"]');

  for (let cb of checkboxes) {
    const clsId = parseInt(cb.value);
    const clsRecord = await getRecord("classes", clsId);

    if (cb.checked) {
      clsRecord.faculty = newFullName;
      await updateRecord("classes", clsRecord);
    } else if (!cb.checked && clsRecord.faculty === oldName) {
      clsRecord.faculty = "";
      await updateRecord("classes", clsRecord);
    }
  }

  if (oldName !== newFullName) {
    const allClasses = await getAll("classes");
    for (let cls of allClasses) {
      if (cls.faculty === oldName) {
        cls.faculty = newFullName;
        await updateRecord("classes", cls);
      }
    }
  }

  showToast("Faculty updated successfully!");
  closeModal("editFacultyModal");

  if (document.getElementById("facultyProfileModal")) {
    document.getElementById("facultyProfileModal").classList.remove("show");
    document.getElementById("facultyProfileModal").style.display = "none";
  }

  loadFaculty();
}

async function viewFacultyProfile(id) {
  const faculty = await getRecord("faculty", id);
  const classes = await getAll("classes");

  if (!faculty) return;
  const fullName = `${faculty.firstname} ${faculty.lastname}`;

  // FIX: Filter out archived classes here too
  const myClasses = classes.filter(
    (c) => c.faculty === fullName && c.is_active !== false,
  );

  let classRows = "";
  if (myClasses.length === 0) {
    classRows =
      '<tr><td colspan="4" style="text-align:center; color:gray;">No active classes assigned.</td></tr>';
  } else {
    myClasses.forEach((cls) => {
      classRows += `<tr><td><strong>${cls.code}</strong></td><td>${
        cls.name
      }</td><td>${cls.semester}</td><td>${cls.year || "N/A"}</td></tr>`;
    });
  }

  const container = document.getElementById("facultyProfileContent");
  container.innerHTML = `
    <div class="profile-section">
        <h2 style="color:var(--color-primary); margin-bottom:5px;">${fullName}</h2>
        <span class="status-badge" style="background:#eaf6fd; color:#2c5282; font-size:14px;">${
          faculty.facultyid
        }</span>
    </div>
    <div class="profile-info-grid">
        <div class="profile-info-item"><label>Department</label><div>${
          faculty.department
        }</div></div>
        <div class="profile-info-item"><label>Email</label><div>${
          faculty.email || "N/A"
        }</div></div>
        <div class="profile-info-item"><label>Specialization</label><div>${
          faculty.specialization || "N/A"
        }</div></div>
    </div>
    <h3 style="margin-bottom:15px; font-size:18px; border-bottom:2px solid var(--color-light); padding-bottom:10px;">📚 Assigned Classes</h3>
    <table><thead><tr><th>Code</th><th>Subject</th><th>Sem</th><th>Year</th></tr></thead><tbody>${classRows}</tbody></table>
  `;

  const btn = document.getElementById("btnEditFacultyClasses");
  if (btn) {
    btn.onclick = function () {
      closeModal("facultyProfileModal");
      openEditFacultyModal(id);
    };
  }
  openModal("facultyProfileModal");
}

async function loadFaculty() {
  const allFaculty = await getAll("faculty");
  const classes = await getAll("classes");
  const tbody = document.getElementById("facultyTableBody");
  const filterBranch = document.getElementById("facultyBranchFilter").value;

  tbody.innerHTML = "";

  const filteredFaculty = allFaculty.filter((f) =>
    filterBranch === "all" ? true : f.department === filterBranch,
  );

  filteredFaculty.forEach((fac) => {
    const fullName = `${fac.firstname} ${fac.lastname}`;

    // FIX: Filter out archived classes (is_active !== false)
    const myClasses = classes.filter(
      (c) => c.faculty === fullName && c.is_active !== false,
    );

    const classBadges = myClasses
      .map(
        (c) =>
          `<span class="assigned-classes-badge">${c.code} (${c.semester})</span>`,
      )
      .join("");

    const tr = document.createElement("tr");
    tr.innerHTML = `
          <td>${fac.facultyid}</td>
          <td><span onclick="viewFacultyProfile(${
            fac.id
          })" style="cursor: pointer; color: var(--color-primary); font-weight: bold;">${fullName}</span></td>
          <td>${
            classBadges ||
            '<span style="color:#999; font-size:11px;">None</span>'
          }</td>
          <td>${fac.department}</td>
          <td>${fac.specialization || "N/A"}</td>
          <td><button class="btn btn-small btn-info" onclick="openEditFacultyModal(${
            fac.id
          })">Edit</button><button class="btn btn-small btn-danger" onclick="deleteFaculty(${
            fac.id
          })">Delete</button></td>`;
    tbody.appendChild(tr);
  });

  // Update Dropdown in Add Class
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

  // Handle Multi-Select for Department
  const deptSelect = document.getElementById("classDept");
  const selectedDepts = Array.from(deptSelect.selectedOptions).map(
    (opt) => opt.value,
  );
  const deptString = selectedDepts.join(","); // Saves as "Civil,Mechanical"

  const classData = {
    code: document.getElementById("classCode").value,
    name: document.getElementById("courseName").value,
    department: deptString, // Store combined string
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
  const idKey = parseInt(document.getElementById("editClassIdKey").value);
  const oldRecord = await getRecord("classes", idKey);

  // Handle Multi-Select for Department
  const deptSelect = document.getElementById("editClassDept");
  const selectedDepts = Array.from(deptSelect.selectedOptions).map(
    (opt) => opt.value,
  );
  const deptString = selectedDepts.join(",");

  const updatedData = {
    id: idKey,
    code: document.getElementById("editClassCode").value,
    name: document.getElementById("editCourseName").value,
    department: deptString, // Store combined string
    semester: parseInt(document.getElementById("editClassSemester").value),
    faculty: document.getElementById("editClassFaculty").value,
    year: parseInt(document.getElementById("editClassYear").value),
    credits: parseInt(document.getElementById("editClassCredits").value),
    createdat: oldRecord
      ? oldRecord.createdat || oldRecord.created_at
      : new Date().toISOString(),
    updatedat: new Date().toISOString(),
  };

  await updateRecord("classes", updatedData);

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
  document.getElementById("editClassSemester").value = cls.semester;
  document.getElementById("editClassYear").value = cls.year;
  document.getElementById("editClassCredits").value = cls.credits;

  // Handle Multi-Select Pre-selection
  const deptSelect = document.getElementById("editClassDept");
  const classDepts = cls.department.split(","); // Split "Civil,Mechanical" back to array

  // Loop options and select if in array
  for (let i = 0; i < deptSelect.options.length; i++) {
    deptSelect.options[i].selected = classDepts.includes(
      deptSelect.options[i].value,
    );
  }

  const allFaculty = await getAll("faculty");
  const select = document.getElementById("editClassFaculty");
  select.innerHTML = '<option value="">-- Select Faculty --</option>';

  allFaculty.forEach((fac) => {
    const name = `${fac.firstname} ${fac.lastname}`;
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

  // Inject Archive Button if missing
  const filterContainer = document.querySelector(
    "#adminClasses .filter-container",
  );
  if (filterContainer && !document.getElementById("btnToggleArchive")) {
    const btn = document.createElement("button");
    btn.id = "btnToggleArchive";
    btn.className = "btn btn-secondary";
    btn.style.marginTop = "15px";
    btn.innerHTML = "🗄️ Show Archived Classes";
    btn.onclick = toggleArchivedView;
    filterContainer.appendChild(btn);
  }

  tbody.innerHTML = "";

  // --- CRITICAL FIX: Read the Correct Filter Dropdown ---
  let branchFilter = "all";

  if (showArchivedClasses) {
    // In Archive Mode: Read from the NEW dropdown
    const el = document.getElementById("archiveClassBranchFilter");
    if (el) branchFilter = el.value;
  } else {
    // In Active Mode: Read from the OLD dropdown
    const el = document.getElementById("classBranchFilter");
    if (el) branchFilter = el.value;
  }
  // -----------------------------------------------------

  const displayedClasses = allClasses.filter((cls) => {
    // A. Archive Status
    const isActive = cls.is_active !== false;
    if (showArchivedClasses) {
      if (isActive) return false;
    } else {
      if (!isActive) return false;
    }

    // B. Branch Filter
    // Inside loadClasses function in ui.js
    // Find the filtering logic section:

    // B. Branch Filter
    if (branchFilter !== "all") {
      // Check if the comma-separated string contains the filter
      if (!cls.department.includes(branchFilter)) return false;
    }

    // C. Year Filter
    if (activeClassFilter.year !== "all") {
      const expectedMinSem = (activeClassFilter.year - 1) * 2 + 1;
      const expectedMaxSem = expectedMinSem + 1;
      if (cls.semester < expectedMinSem || cls.semester > expectedMaxSem)
        return false;
    }

    // D. Semester Filter
    if (
      activeClassFilter.semester !== null &&
      cls.semester !== activeClassFilter.semester
    )
      return false;

    return true;
  });

  if (displayedClasses.length === 0) {
    const mode = showArchivedClasses ? "archived" : "active";
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px;">No ${mode} classes found for the selected filters.</td></tr>`;
    return;
  }

  displayedClasses.forEach((cls) => {
    const tr = document.createElement("tr");
    let actionButtons = "";
    if (showArchivedClasses) {
      actionButtons = `<button class="btn btn-small btn-success" onclick="restoreClass(${cls.id})">♻️ Restore</button>`;
    } else {
      actionButtons = `
            <button class="btn btn-small btn-info" onclick="openEditClassModal(${cls.id})">Edit</button>
            <button class="btn btn-small btn-warning" onclick="archiveClass(${cls.id})">🗄️</button>
            <button class="btn btn-small btn-danger" onclick="deleteClass(${cls.id})">🗑️</button>`;
    }

    tr.innerHTML = `
        <td>${cls.code}</td>
        <td>${cls.name}</td>
        <td>${cls.department}</td>
        <td>${cls.semester}</td>
        <td>${cls.faculty}</td>
        <td>${cls.year}</td>
        <td>${cls.credits}</td>
        <td>${actionButtons}</td>`;
    tbody.appendChild(tr);
  });
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
  try {
    const students = await getAll("students");
    const faculty = await getAll("faculty");
    const classes = await getAll("classes");

    // Check if elements exist before updating to prevent errors
    const studentCountEl = document.getElementById("exportStudentCount");
    const facultyCountEl = document.getElementById("exportFacultyCount");
    const classCountEl = document.getElementById("exportClassCount");

    if (studentCountEl) studentCountEl.textContent = students.length;
    if (facultyCountEl) facultyCountEl.textContent = faculty.length;
    if (classCountEl) classCountEl.textContent = classes.length;

    console.log("✅ Export stats updated");
  } catch (error) {
    console.error("Failed to update export stats:", error);
  }
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
  // Option A: Specific Checkboxes Selected
  if (selectedStudentIds && selectedStudentIds.size > 0) {
    console.log(
      `[DEBUG] Using ${selectedStudentIds.size} selected checkboxes.`,
    );
    // displayedStudents must be available globally from config.js/main.js
    return displayedStudents.filter((s) => selectedStudentIds.has(s.id));
  }

  // Option B: Apply to All Currently Visible
  console.log(
    `[DEBUG] Using all ${displayedStudents.length} displayed students.`,
  );
  return displayedStudents;
}

function filterClasses(year) {
  activeClassFilter.year = year;
  activeClassFilter.semester = null;

  const group = document.getElementById("classYearFilterGroup");
  if (group) {
    for (let btn of group.children) btn.classList.remove("active");
    if (event && event.target) event.target.classList.add("active");
  }

  const semContainer = document.getElementById("classSemesterFilterGroup");
  const semButtons = document.getElementById("classSemesterButtons");

  if (semContainer && semButtons) {
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
  }
  loadClasses();
}

function filterClassesBySemester(sem, event) {
  activeClassFilter.semester = sem;
  const semButtons = document.getElementById("classSemesterButtons");
  if (semButtons) {
    for (let btn of semButtons.children) btn.classList.remove("active");
    if (event && event.target) event.target.classList.add("active");
  }
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
    document.getElementById("selectAllText").textContent =
      `You have selected ${count} students.`;
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
      `#student-card-${student.id} .attendance-checkbox`,
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

function toggleDateRange() {
  const rangeInputs = document.getElementById("dateRangeInputs");
  const isRange = document.querySelector(
    'input[name="dateFilterType"][value="range"]',
  ).checked;

  if (rangeInputs) {
    rangeInputs.style.display = isRange ? "flex" : "none";
  }
}

// REPLACE THIS FUNCTION IN ui.js
function toggleArchivedView() {
  showArchivedClasses = !showArchivedClasses;

  // 1. Update Button Text
  const btn = document.getElementById("btnToggleArchive");
  if (btn) {
    btn.textContent = showArchivedClasses
      ? "📂 Show Active Classes"
      : "🗄️ Show Archived Classes";
    btn.className = showArchivedClasses
      ? "btn btn-primary"
      : "btn btn-secondary";
  }

  // 2. Toggle Visibility of Filter Containers
  const activeContainer = document.getElementById(
    "activeBranchFilterContainer",
  );
  const archiveContainer = document.getElementById(
    "archiveBranchFilterContainer",
  );

  if (activeContainer && archiveContainer) {
    if (showArchivedClasses) {
      // Show Archive Filter, Hide Active Filter
      activeContainer.style.display = "none";
      archiveContainer.style.display = "block";
      // Reset Archive filter to 'All' to avoid confusion on toggle
      document.getElementById("archiveClassBranchFilter").value = "all";
    } else {
      // Show Active Filter, Hide Archive Filter
      activeContainer.style.display = "block";
      archiveContainer.style.display = "none";
      // Reset Active filter to 'All'
      document.getElementById("classBranchFilter").value = "all";
    }
  }

  loadClasses();
}

async function archiveClass(id) {
  const cls = await getRecord("classes", id);
  if (!cls) return;

  showConfirm(
    `Archive "${cls.code}"? \n\nThis will hide the class and rename it to "${cls.code}_ARCHIVED" so you can reuse the code.`,
    async function () {
      const newCode = `${cls.code}_${cls.year}_ARCHIVED_${Date.now()
        .toString()
        .slice(-4)}`;
      const updatedData = {
        id: cls.id,
        code: newCode,
        is_active: false,
        updatedat: new Date().toISOString(),
      };
      await updateRecord("classes", updatedData);
      showToast("Class archived successfully!", "success");
      loadClasses();
    },
  );
}

async function restoreClass(id) {
  const cls = await getRecord("classes", id);
  if (!cls) return;

  const cleanCode = cls.code.split("_")[0];
  const newCode = prompt(`Enter the code to restore this class as:`, cleanCode);
  if (!newCode) return;

  const updatedData = {
    id: cls.id,
    code: newCode,
    is_active: true,
    updatedat: new Date().toISOString(),
  };
  await updateRecord("classes", updatedData);
  showToast("Class restored successfully!", "success");
  loadClasses();
}

function filterStudentsByBranch() {
  const branchSelect = document.getElementById("studentBranchFilter");
  const branch = branchSelect ? branchSelect.value : "all";
  activeStudentFilter.branch = branch;
  loadStudents();
}

// =============================================
// EDIT STUDENT LOGIC
// =============================================

// 1. Open Modal & Pre-fill Data
async function openEditStudentModal(id) {
  const student = await getRecord("students", id);
  if (!student) return;

  // Set values in the modal
  document.getElementById("editStudentIdKey").value = student.id;
  document.getElementById("editStudentRollNo").value =
    student.rollno || student.rollNo || "";
  document.getElementById("editStudentFirstName").value =
    student.firstname || student.firstName || "";
  document.getElementById("editStudentLastName").value =
    student.lastname || student.lastName || "";
  document.getElementById("editStudentEmail").value = student.email || "";
  document.getElementById("editStudentDept").value =
    student.department || "Computer Science";
  document.getElementById("editStudentYear").value = student.year || 1;
  document.getElementById("editStudentSemester").value = student.semester || 1;

  openModal("editUserModal");
}

// 2. Save Changes
async function updateStudent(event) {
  event.preventDefault();

  const idKey = parseInt(document.getElementById("editStudentIdKey").value);
  const oldRecord = await getRecord("students", idKey);

  // Construct updated object
  const updatedData = {
    id: idKey, // Primary Key
    rollno: document.getElementById("editStudentRollNo").value,
    firstname: document.getElementById("editStudentFirstName").value,
    lastname: document.getElementById("editStudentLastName").value,
    email: document.getElementById("editStudentEmail").value,
    department: document.getElementById("editStudentDept").value,
    year: parseInt(document.getElementById("editStudentYear").value),
    semester: parseInt(document.getElementById("editStudentSemester").value),
    // Preserve old creation date
    createdat: oldRecord
      ? oldRecord.createdat || oldRecord.created_at
      : new Date().toISOString(),
    updatedat: new Date().toISOString(),
  };

  await updateRecord("students", updatedData);

  showToast("Student details updated successfully!");
  closeModal("editUserModal");
  loadStudents(); // Refresh table
}

function debugPromote() {
  console.log("=== DEBUG PROMOTE FUNCTION ===");

  // Check table
  const tableBody = document.getElementById("usersTableBody");
  console.log("Table body exists:", !!tableBody);
  console.log(
    "Table HTML (first 500 chars):",
    tableBody.innerHTML.substring(0, 500),
  );

  // Check checkboxes
  const checkboxes = document.querySelectorAll(".student-checkbox");
  const checkedBoxes = document.querySelectorAll(".student-checkbox:checked");
  console.log("Total checkboxes:", checkboxes.length);
  console.log("Checked checkboxes:", checkedBoxes.length);

  // Test extracting data from first row
  const firstRow = tableBody.querySelector("tr");
  if (firstRow) {
    const cells = firstRow.querySelectorAll("td");
    console.log("First row cells:", cells.length);
    if (cells.length >= 6) {
      console.log("Semester cell text:", cells[5].textContent);
    }
  }
}
