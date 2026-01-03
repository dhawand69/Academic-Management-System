// marks.js - Handles Internal Marks Logic

// ==========================================
// 1. FACULTY SECTION: LOAD & UPDATE MARKS
// ==========================================

async function populateFacultyMarksDropdown() {
  // Only populates the FACULTY dropdown
  const classes = await getAll("classes");
  const select = document.getElementById("facultyMarksClassSelect");

  if (!select) return;
  select.innerHTML = '<option value="">-- Select a class --</option>';

  if (!currentUser || currentUser.role !== "faculty") return;

  const facultyName = `${currentUser.firstname} ${currentUser.lastname}`;
  // Loose comparison for strings to avoid case/space issues
  const myClasses = classes.filter(
    (c) => c.faculty.trim().toLowerCase() === facultyName.trim().toLowerCase()
  );

  myClasses.forEach((cls) => {
    const opt = document.createElement("option");
    opt.value = cls.id;
    opt.textContent = `${cls.code}: ${cls.name}`;
    select.appendChild(opt);
  });
}

// marks.js

// 1. UPDATE THIS FUNCTION
// marks.js - Updated loadFacultyMarksTable function

// marks.js - Updated loadFacultyMarksTable function

async function loadFacultyMarksTable() {
  const classId = parseInt(
    document.getElementById("facultyMarksClassSelect").value
  );
  const container = document.getElementById("marksEntryContainer");
  const tbody = document.getElementById("facultyMarksBody");

  // Inputs for Max Marks
  const maxMidInput = document.getElementById("maxMidSem");
  const maxAssInput = document.getElementById("maxAssign");
  const maxAttInput = document.getElementById("maxAtt");

  if (!classId) {
    container.style.display = "none";
    return;
  }

  tbody.innerHTML =
    '<tr><td colspan="6" style="text-align:center;">Loading students from attendance records...</td></tr>';
  container.style.display = "block";

  try {
    // 1. Fetch necessary data: Students, Classes, Marks, AND Attendance
    const [allStudents, allClasses, allMarks, allAttendance] =
      await Promise.all([
        getAll("students"),
        getAll("classes"),
        getAll("internal_marks"),
        getAll("attendance"),
      ]);

    const cls = allClasses.find((c) => c.id === classId);

    // --- LOAD SAVED MAX MARKS STRUCTURE ---
    if (cls) {
      maxMidInput.value =
        cls.max_midsem !== undefined && cls.max_midsem !== null
          ? cls.max_midsem
          : 20;
      maxAssInput.value =
        cls.max_assignment !== undefined && cls.max_assignment !== null
          ? cls.max_assignment
          : 10;
      maxAttInput.value =
        cls.max_attendance !== undefined && cls.max_attendance !== null
          ? cls.max_attendance
          : 10;
    }

    // --- NEW LOGIC: FILTER STUDENTS BY ATTENDANCE ---

    // 2. Find all attendance records for this specific class
    // We use strict filtering by classid to ensure we only get relevant students
    const classAttendance = allAttendance.filter((r) => r.classid === classId);

    // 3. Extract Unique Student IDs using a Set
    const uniqueStudentIds = new Set(classAttendance.map((r) => r.studentid));

    // 4. Filter the main student list to only include these IDs
    let classStudents = allStudents.filter((s) => uniqueStudentIds.has(s.id));

    // Fallback: If no attendance exists, warn the user
    if (classStudents.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;">No students found in attendance records for this class.<br><small style="color:gray">Please mark attendance for at least one session to populate this list.</small></td></tr>';
      return;
    }
    // ------------------------------------------------

    // Sort by Roll No
    classStudents.sort((a, b) =>
      (a.rollno || "").localeCompare(b.rollno || "")
    );

    // Filter existing marks for this class to pre-fill inputs
    const existingMarks = allMarks.filter((m) => m.classid === classId);
    const marksMap = new Map(existingMarks.map((m) => [m.studentid, m]));

    tbody.innerHTML = "";

    classStudents.forEach((student) => {
      const marks = marksMap.get(student.id) || {
        midsem: 0,
        assignment: 0,
        attendance: 0,
        total: 0,
      };

      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${student.rollno}</td>
                <td>${student.firstname} ${student.lastname}</td>
                <td>
                    <input type="number" class="mark-input midsem" data-sid="${student.id}" 
                           value="${marks.midsem}" min="0" onchange="calculateRowTotal(this)">
                </td>
                <td>
                    <input type="number" class="mark-input assign" data-sid="${student.id}" 
                           value="${marks.assignment}" min="0" onchange="calculateRowTotal(this)">
                </td>
                <td>
                    <input type="number" class="mark-input att" data-sid="${student.id}" 
                           value="${marks.attendance}" min="0" onchange="calculateRowTotal(this)">
                </td>
                <td style="font-weight:bold; color:var(--color-primary);">
                    <span id="total-${student.id}">${marks.total}</span>
                </td>
            `;
      tbody.appendChild(tr);
    });

    // Trigger initial calculation check
    recalculateAllTotals();
  } catch (error) {
    console.error("Error loading marks:", error);
    showToast("Error loading data", "error");
  }
}

// 2. ADD THIS NEW FUNCTION (Paste anywhere in marks.js)
async function saveMaxMarksConfiguration() {
  const classId = parseInt(
    document.getElementById("facultyMarksClassSelect").value
  );

  if (!classId) {
    showToast("Please select a class first.", "error");
    return;
  }

  const maxMid = parseFloat(document.getElementById("maxMidSem").value) || 0;
  const maxAss = parseFloat(document.getElementById("maxAssign").value) || 0;
  const maxAtt = parseFloat(document.getElementById("maxAtt").value) || 0;

  // Call updateRecord on the 'classes' table
  // Note: We only need to send ID and the fields we want to update
  const result = await updateRecord("classes", {
    id: classId,
    max_midsem: maxMid,
    max_assignment: maxAss,
    max_attendance: maxAtt,
  });

  if (result) {
    showToast("✅ Max marks structure saved for this subject!", "success");
    // Re-validate current entries against new max
    recalculateAllTotals();
  } else {
    showToast("Failed to save structure.", "error");
  }
}

function calculateRowTotal(input) {
  const row = input.closest("tr");
  const studentId = input.dataset.sid;

  // Get inputs
  const mid = parseFloat(row.querySelector(".midsem").value) || 0;
  const ass = parseFloat(row.querySelector(".assign").value) || 0;
  const att = parseFloat(row.querySelector(".att").value) || 0;

  // Get limits
  const maxMid = parseFloat(document.getElementById("maxMidSem").value) || 100;
  const maxAss = parseFloat(document.getElementById("maxAssign").value) || 100;
  const maxAtt = parseFloat(document.getElementById("maxAtt").value) || 100;

  // Validation visual feedback
  validateInput(row.querySelector(".midsem"), maxMid);
  validateInput(row.querySelector(".assign"), maxAss);
  validateInput(row.querySelector(".att"), maxAtt);

  // Update total text
  const total = mid + ass + att;
  document.getElementById(`total-${studentId}`).textContent = total;
}

function validateInput(input, max) {
  if (parseFloat(input.value) > max) {
    input.style.border = "2px solid red";
    input.title = `Max value is ${max}`;
  } else {
    input.style.border = "1px solid #ddd";
    input.title = "";
  }
}

function recalculateAllTotals() {
  const rows = document.querySelectorAll("#facultyMarksBody tr");
  rows.forEach((row) => {
    const input = row.querySelector(".midsem");
    if (input) calculateRowTotal(input);
  });
}

async function saveInternalMarks() {
  const classId = parseInt(
    document.getElementById("facultyMarksClassSelect").value
  );
  if (!classId) return;

  showToast("Saving marks...", "info");

  const rows = document.querySelectorAll("#facultyMarksBody tr");
  const allMarks = await getAll("internal_marks");

  const existingMarksMap = new Map(
    allMarks.filter((m) => m.classid === classId).map((m) => [m.studentid, m])
  );

  const promises = [];

  rows.forEach((row) => {
    const midInput = row.querySelector(".midsem");
    if (!midInput) return;

    const studentId = parseInt(midInput.dataset.sid);
    const mid = parseFloat(midInput.value) || 0;
    const ass = parseFloat(row.querySelector(".assign").value) || 0;
    const att = parseFloat(row.querySelector(".att").value) || 0;
    const total =
      parseFloat(document.getElementById(`total-${studentId}`).textContent) ||
      0;

    const record = {
      classid: classId,
      studentid: studentId,
      midsem: mid,
      assignment: ass,
      attendance: att,
      total: total,
      updatedat: new Date().toISOString(),
    };

    const existing = existingMarksMap.get(studentId);

    if (existing) {
      record.id = existing.id;
      record.createdat = existing.createdat;
      promises.push(updateRecord("internal_marks", record));
    } else {
      record.createdat = new Date().toISOString();
      promises.push(addRecord("internal_marks", record));
    }
  });

  await Promise.all(promises);
  showToast("All marks saved successfully!", "success");
}

// ==========================================
// 2. ADMIN SECTION: DYNAMIC FILTERS & LOGIC
// ==========================================

async function initAdminMarksFilters() {
  const yearSelect = document.getElementById("adminMarksYearFilter");
  const branchSelect = document.getElementById("adminMarksBranchFilter");
  const semSelect = document.getElementById("adminMarksSemesterFilter");

  // Only run if elements exist (Admin Panel)
  if (yearSelect && branchSelect && semSelect) {
    // Event Listeners
    yearSelect.addEventListener("change", async () => {
      updateAdminMarksSemesterOptions(); // 1. Fix Sems based on Year
      await populateAdminMarksClassDropdown(); // 2. Fix Classes
    });

    branchSelect.addEventListener("change", async () => {
      await populateAdminMarksClassDropdown();
    });

    semSelect.addEventListener("change", async () => {
      await populateAdminMarksClassDropdown();
    });

    // Initial Trigger
    updateAdminMarksSemesterOptions();
    await populateAdminMarksClassDropdown();
  }
}

// Logic: Year 1 -> Sem 1,2 | Year 2 -> Sem 3,4
function updateAdminMarksSemesterOptions() {
  const yearFilter = document.getElementById("adminMarksYearFilter").value;
  const semSelect = document.getElementById("adminMarksSemesterFilter");
  const currentSem = semSelect.value;

  semSelect.innerHTML = '<option value="all">All Semesters</option>';

  let startSem = 1;
  let endSem = 8;

  if (yearFilter !== "all") {
    const y = parseInt(yearFilter);
    startSem = (y - 1) * 2 + 1;
    endSem = startSem + 1;
  }

  for (let i = startSem; i <= endSem; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `Semester ${i}`;
    semSelect.appendChild(opt);
  }

  // Try to keep selection if valid
  if (
    currentSem !== "all" &&
    parseInt(currentSem) >= startSem &&
    parseInt(currentSem) <= endSem
  ) {
    semSelect.value = currentSem;
  } else {
    semSelect.value = "all";
  }
}

// Logic: Filter Classes by Branch + Year + Sem
async function populateAdminMarksClassDropdown() {
  const yearFilter = document.getElementById("adminMarksYearFilter").value;
  const branchFilter = document.getElementById("adminMarksBranchFilter").value;
  const semesterFilter = document.getElementById(
    "adminMarksSemesterFilter"
  ).value;
  const classSelect = document.getElementById("adminMarksClassFilter");

  if (!classSelect) return;

  classSelect.innerHTML = '<option value="">Loading...</option>';

  const classes = await getAll("classes");

  // Filter Logic
  const filteredClasses = classes.filter((cls) => {
    // 1. Branch Filter
    if (branchFilter !== "all" && cls.department !== branchFilter) return false;

    // 2. Semester Filter (Priority)
    if (semesterFilter !== "all") {
      if (cls.semester != semesterFilter) return false;
    } else {
      // 3. Year Filter (Only if Semester is ALL)
      if (yearFilter !== "all") {
        const clsYear = Math.ceil(cls.semester / 2);
        if (clsYear != yearFilter) return false;
      }
    }

    // 4. Exclude Archived
    if (cls.is_active === false) return false;

    return true;
  });

  classSelect.innerHTML = '<option value="all">All Classes</option>';

  if (filteredClasses.length === 0) {
    const opt = document.createElement("option");
    opt.disabled = true;
    opt.textContent = "No classes found";
    classSelect.appendChild(opt);
  } else {
    filteredClasses.forEach((cls) => {
      const opt = document.createElement("option");
      opt.value = cls.id;
      opt.textContent = `${cls.code}: ${cls.name}`;
      classSelect.appendChild(opt);
    });
  }
}

async function loadAdminMarksTable() {
  const tbody = document.querySelector("#adminMarksTable tbody");
  tbody.innerHTML =
    '<tr><td colspan="7" style="text-align:center;">Loading data...</td></tr>';

  // Get Filter Values
  const yearFilter = document.getElementById("adminMarksYearFilter").value;
  const branchFilter = document.getElementById("adminMarksBranchFilter").value;
  const semesterFilter = document.getElementById(
    "adminMarksSemesterFilter"
  ).value;
  const classFilter = document.getElementById("adminMarksClassFilter").value;
  const sortBy = document.getElementById("adminMarksSortBy").value;

  try {
    const [allStudents, allMarks] = await Promise.all([
      getAll("students"),
      getAll("internal_marks"),
    ]);

    // Filter Marks
    let filteredMarks = allMarks;
    if (classFilter !== "all") {
      filteredMarks = filteredMarks.filter((m) => m.classid == classFilter);
    }

    // Map & Academic Filters
    let displayData = [];

    filteredMarks.forEach((mark) => {
      const student = allStudents.find((s) => s.id === mark.studentid);
      if (!student) return;

      // Apply Academic Filters
      const studentYear = Math.ceil(student.semester / 2);
      if (yearFilter !== "all" && studentYear != yearFilter) return;
      if (branchFilter !== "all" && student.department !== branchFilter) return;
      if (semesterFilter !== "all" && student.semester != semesterFilter)
        return;

      displayData.push({
        student: student,
        mark: mark,
        total: parseFloat(mark.total) || 0,
      });
    });

    // Sort
    displayData.sort((a, b) => {
      switch (sortBy) {
        case "total_desc":
          return b.total - a.total;
        case "total_asc":
          return a.total - b.total;
        case "rollno_asc":
          return (a.student.rollno || "").localeCompare(b.student.rollno || "");
        case "name_asc":
          return (a.student.firstname || "").localeCompare(
            b.student.firstname || ""
          );
        default:
          return 0;
      }
    });

    // Render
    tbody.innerHTML = "";
    document.getElementById(
      "adminMarksCount"
    ).textContent = `(${displayData.length})`;

    if (displayData.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;">No records found matching filters.</td></tr>';
      return;
    }

    displayData.forEach((item) => {
      const s = item.student;
      const m = item.mark;
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${s.rollno || "N/A"}</td>
                <td>${s.firstname} ${s.lastname}</td>
                <td>${s.department}</td>
                <td>${m.midsem}</td>
                <td>${m.assignment}</td>
                <td>${m.attendance}</td>
                <td style="font-weight:bold; color:var(--color-primary);">${
                  m.total
                }</td>
            `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error loading marks:", error);
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center; color:red;">Error loading data.</td></tr>';
  }
}

async function exportInternalMarks(format) {
  const classId = document.getElementById("adminMarksClassFilter").value;

  if (
    classId === "all" &&
    !confirm("Export consolidated report for ALL classes?")
  ) {
    return;
  }

  showToast(`Generating ${format.toUpperCase()} report...`, "info");

  const [allStudents, allMarks, allClasses] = await Promise.all([
    getAll("students"),
    getAll("internal_marks"),
    getAll("classes"),
  ]);

  // Data Filtering (Same as Table)
  let filteredMarks = allMarks;
  if (classId !== "all") {
    filteredMarks = filteredMarks.filter((m) => m.classid == classId);
  }

  const yearFilter = document.getElementById("adminMarksYearFilter").value;
  const branchFilter = document.getElementById("adminMarksBranchFilter").value;
  const semesterFilter = document.getElementById(
    "adminMarksSemesterFilter"
  ).value;

  let reportData = [];
  filteredMarks.forEach((mark) => {
    const student = allStudents.find((s) => s.id === mark.studentid);
    if (!student) return;

    const studentYear = Math.ceil(student.semester / 2);
    if (yearFilter !== "all" && studentYear != yearFilter) return;
    if (branchFilter !== "all" && student.department !== branchFilter) return;
    if (semesterFilter !== "all" && student.semester != semesterFilter) return;

    reportData.push({
      rollNo: student.rollno,
      name: `${student.firstname} ${student.lastname}`,
      dept: student.department,
      sem: student.semester,
      midsem: mark.midsem,
      assignment: mark.assignment,
      attendance: mark.attendance,
      total: parseFloat(mark.total) || 0,
    });
  });

  reportData.sort((a, b) => b.total - a.total);

  // Stats
  let highest = 0,
    lowest = 0,
    average = 0;
  if (reportData.length > 0) {
    const totals = reportData.map((d) => d.total);
    highest = Math.max(...totals);
    lowest = Math.min(...totals);
    average = Math.round(totals.reduce((a, b) => a + b, 0) / reportData.length);
  }

  // Header
  let selectedClass = allClasses.find((c) => c.id == classId);
  let headerText =
    "==================================================================\n";
  if (selectedClass) {
    headerText += `Internal Marks Report – Subject: ${selectedClass.name} (${selectedClass.code})\n`;
    headerText += `Department: ${selectedClass.department} | Semester: ${selectedClass.semester}\n`;
    headerText += `Faculty: ${selectedClass.faculty}\n`;
  } else {
    headerText += `Internal Marks Report – Consolidated\n`;
  }
  headerText += `Total Students: ${reportData.length}\n`;
  headerText += `Score:\n  Highest → ${highest}\n  Lowest  → ${lowest}\n  Average → ${average}\n`;
  headerText +=
    "==================================================================\n";

  // Export Logic
  if (format === "csv" || format === "excel") {
    let csvContent =
      headerText +
      "\nRoll No,Name,Department,Mid-Sem,Assignment,Attendance,Total\n";
    reportData.forEach((row) => {
      csvContent += `${row.rollNo},"${row.name}",${row.dept},${row.midsem},${row.assignment},${row.attendance},${row.total}\n`;
    });
    downloadCSV(
      csvContent,
      selectedClass
        ? `Marks_${selectedClass.code}.csv`
        : `Marks_Consolidated.csv`
    );
  } else if (format === "json") {
    const jsonData = {
      meta: { stats: { highest, lowest, average } },
      data: reportData,
    };
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "marks.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else if (format === "pdf") {
    const printWindow = window.open("", "_blank");
    const htmlHeader = headerText.replace(/\n/g, "<br>");
    let htmlContent = `<html><head><title>Report</title><style>body{font-family:monospace;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:8px;}</style></head><body>
            <div style="background:#f4f4f4;padding:15px;margin-bottom:20px;">${htmlHeader}</div>
            <table><thead><tr><th>Roll No</th><th>Name</th><th>Mid</th><th>Assn</th><th>Att</th><th>Total</th></tr></thead><tbody>`;
    reportData.forEach((r) => {
      htmlContent += `<tr><td>${r.rollNo}</td><td>${r.name}</td><td>${r.midsem}</td><td>${r.assignment}</td><td>${r.attendance}</td><td><b>${r.total}</b></td></tr>`;
    });
    htmlContent += `</tbody></table></body></html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  }
}

// Initialize Admin Filters when file loads
document.addEventListener("DOMContentLoaded", initAdminMarksFilters);
