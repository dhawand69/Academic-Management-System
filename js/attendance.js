// =============================================
// ATTENDANCE MANAGEMENT FUNCTIONS
// =============================================

// Populate class dropdown for faculty
// Populate class dropdown for faculty
async function populateFacultyClassDropdown() {
  const classes = await getAll("classes");
  const facultySelect = document.getElementById("facultyClassSelect");
  const historySelect = document.getElementById("historyClassSelect");

  if (facultySelect)
    facultySelect.innerHTML = '<option value="">-- Select a class --</option>';
  if (historySelect)
    historySelect.innerHTML = '<option value="">-- Select a class --</option>';

  // FIX: Use lowercase keys to match the fixed auth.js and database
  const facultyName = `${currentUser.firstname} ${currentUser.lastname}`;

  console.log("Logged in as:", facultyName); // Debugging line

  let myClasses;

  if (currentUser.role === "admin") {
    myClasses = classes; // Admins can see all classes
  } else {
    // Trim spaces to ensure accurate matching
    myClasses = classes.filter((c) => c.faculty.trim() === facultyName.trim());
  }

  if (myClasses.length === 0) {
    console.warn("No classes found for faculty:", facultyName);
  }

  myClasses.forEach((cls) => {
    const opt1 = document.createElement("option");
    opt1.value = cls.id;
    opt1.textContent = `${cls.code}: ${cls.name} (Sem ${cls.semester}, ${cls.department})`;

    if (facultySelect) facultySelect.appendChild(opt1.cloneNode(true));
    if (historySelect) historySelect.appendChild(opt1);
  });
}

async function processOCR() {
  const fileInput = document.getElementById("ocrImageInput");
  const statusDiv = document.getElementById("ocrStatus");
  const progressFill = document.getElementById("ocrProgressFill");
  const progressBar = document.getElementById("ocrProgressBar");
  const bulkInput = document.getElementById("bulkAttendanceInput");
  const classSelect = document.getElementById("facultyClassSelect");

  if (!classSelect || !classSelect.value) {
    showToast("Please select a Class on the main screen first!", "warning");
    return;
  }

  if (!fileInput.files || fileInput.files.length === 0) {
    showToast("Please select or capture an image first.", "warning");
    return;
  }

  const file = fileInput.files[0];
  const classId = parseInt(classSelect.value);

  // Lock UI
  document.getElementById("btnProcessOCR").disabled = true;
  progressBar.style.display = "block";
  progressFill.style.width = "0%";
  statusDiv.textContent = "⏳ Decoding handwriting... Please wait.";
  statusDiv.style.color = "var(--color-info)";

  try {
    // 1. Fetch Class Students
    const [allStudents, allClasses] = await Promise.all([
      getAll("students"),
      getAll("classes"),
    ]);

    const selectedClass = allClasses.find((c) => c.id === classId);
    const targetDepartments = selectedClass.department.split(",");

    const validStudents = allStudents.filter(
      (s) =>
        s.semester == selectedClass.semester &&
        targetDepartments.includes(s.department),
    );
    const validRollNumbers = validStudents.map((s) =>
      s.rollno.toString().trim(),
    );

    // 2. Run Tesseract
    const result = await Tesseract.recognize(file, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text" && progressFill) {
          progressFill.style.width = `${Math.round(m.progress * 100)}%`;
        }
      },
    });

    const extractedText = result.data.text;
    console.log("Raw OCR Text:\n", extractedText);

    // --- 3. ULTRA-AGGRESSIVE SANITIZATION ENGINE ---
    const matchedNumbers = new Set();

    // This dictionary specifically targets the hallucinations from your image
    const aggressiveCorrections = {
      O: "0",
      o: "0",
      D: "0",
      Q: "0",
      "@": "0",
      U: "0",
      C: "0",
      "%": "0",
      I: "1",
      l: "1",
      i: "1",
      "|": "1",
      "]": "1",
      "[": "1",
      "!": "1",
      "\\": "1",
      "/": "1",
      t: "1",
      L: "1",
      j: "1",
      Z: "2",
      z: "2",
      "£": "2",
      "?": "2",
      E: "3",
      e: "3",
      A: "4",
      Y: "4",
      y: "4",
      "¥": "4",
      S: "5",
      s: "5",
      G: "6",
      b: "6",
      T: "7",
      F: "7",
      B: "8",
      "&": "8",
      g: "9",
      q: "9",
      P: "9",
    };

    // Process the text line by line to prevent cross-contamination
    const lines = extractedText.split("\n");

    lines.forEach((line) => {
      // Step A: Force convert lookalike letters to numbers
      let mappedLine = "";
      for (let char of line) {
        mappedLine +=
          aggressiveCorrections[char] !== undefined
            ? aggressiveCorrections[char]
            : char;
      }

      // Step B: Strip EVERYTHING that isn't a digit (crushes spaces and stray letters)
      const pureDigits = mappedLine.replace(/\D/g, "");

      // Step C: Validate & Hunt
      // If the line has at least 5 digits, it likely contains a roll number
      if (pureDigits.length >= 5) {
        // Check if this line actually contains a roll number prefix anchor to prevent false positives
        // (Looking for variants of 221, 156, or 148)
        const hasAnchor =
          pureDigits.includes("22") ||
          pureDigits.includes("156") ||
          pureDigits.includes("148") ||
          pureDigits.includes("291");

        if (hasAnchor) {
          // Hunt for the students in our database
          validRollNumbers.forEach((validRoll) => {
            const serial3 = validRoll.slice(-3); // e.g. "003"
            const serial4 = validRoll.slice(-4); // e.g. "8003"

            // If the pure digit string contains their specific serial number, it's a match!
            if (pureDigits.includes(serial4) || pureDigits.includes(serial3)) {
              matchedNumbers.add(validRoll);
            }
          });
        }
      }
    });

    // 4. Output Generation
    const uniqueMatched = Array.from(matchedNumbers);

    if (uniqueMatched.length === 0) {
      statusDiv.textContent =
        "⚠️ Handwriting too unclear. Could not map any students.";
      statusDiv.style.color = "var(--color-danger)";
    } else {
      statusDiv.textContent = `✅ Recovered & mapped ${uniqueMatched.length} student(s)!`;
      statusDiv.style.color = "var(--color-success)";

      let existingText = bulkInput.value.trim();
      let newText = uniqueMatched.map((num) => `${num}, P`).join("\n");

      bulkInput.value = existingText ? existingText + "\n" + newText : newText;
      showToast("Review the recovered numbers below.", "success");
    }
  } catch (error) {
    console.error("OCR Error:", error);
    statusDiv.textContent = "❌ Processing failed. Please try again.";
    statusDiv.style.color = "var(--color-danger)";
  } finally {
    document.getElementById("btnProcessOCR").disabled = false;
    setTimeout(() => {
      progressBar.style.display = "none";
    }, 2000);
  }
}

// Populate admin class filter
async function populateAdminClassFilter(
  semesterFilter = "all",
  branchFilter = "all",
) {
  const classes = await getAll("classes");
  const classSelect = document.getElementById("adminClassFilter");

  classSelect.innerHTML = '<option value="all">All Classes</option>';

  let filteredClasses = classes;

  if (semesterFilter !== "all") {
    filteredClasses = filteredClasses.filter(
      (cls) => cls.semester == semesterFilter,
    );
  }

  if (branchFilter !== "all") {
    filteredClasses = filteredClasses.filter(
      (cls) => cls.department === branchFilter,
    );
  }

  filteredClasses.forEach((cls) => {
    const opt = document.createElement("option");
    opt.value = cls.id;
    opt.textContent = `${cls.code}: ${cls.name} (Sem ${cls.semester}, ${cls.department})`;
    classSelect.appendChild(opt);
  });
}

// Update class filter dropdown
async function updateClassFilterDropdown(semesterFilter, branchFilter) {
  const classSelect = document.getElementById("adminClassFilter");
  const allClasses = await getAll("classes");

  // Store the current selection
  const currentSelection = classSelect.value;

  // Clear options except the first one
  classSelect.innerHTML = '<option value="all">All Classes</option>';

  // Filter classes based on semester and branch
  let filteredClasses = allClasses;

  if (semesterFilter !== "all") {
    filteredClasses = filteredClasses.filter(
      (cls) => cls.semester == semesterFilter,
    );
  }

  if (branchFilter !== "all") {
    filteredClasses = filteredClasses.filter(
      (cls) => cls.department === branchFilter,
    );
  }

  // Add filtered classes to dropdown
  filteredClasses.forEach((cls) => {
    const opt = document.createElement("option");
    opt.value = cls.id;
    opt.textContent = `${cls.code}: ${cls.name} (Sem ${cls.semester}, ${cls.department})`;

    // Restore selection if this was the previously selected class
    if (currentSelection == cls.id) {
      opt.selected = true;
    }

    classSelect.appendChild(opt);
  });

  // If current selection is not "all" and not in filtered list, select "all"
  if (
    currentSelection !== "all" &&
    !filteredClasses.find((c) => c.id == currentSelection)
  ) {
    classSelect.value = "all";
  }
}

// Populate student dashboard
// Populate student dashboard
async function populateStudentDashboard(student) {
  // FIX: Using lowercase keys (firstname, lastname, rollno)
  document.getElementById("studentNameDisplay").textContent =
    `${student.firstname} ${student.lastname}`;

  document.getElementById("studentRollDisplay").textContent =
    `Roll No: ${student.rollno}`;

  document.getElementById("studentEmailDisplay").textContent =
    student.email || "N/A";
  document.getElementById("studentDeptDisplay").textContent =
    student.department;
  document.getElementById("studentSemDisplay").textContent = student.semester;
  document.getElementById("studentYearDisplay").textContent = student.year;

  await loadStudentStats(student.id);
}

// Load student statistics
// Load student statistics
async function loadStudentStats(studentId) {
  const attendance = await getAll("attendance");
  const classes = await getAll("classes");

  // FIX: Using lowercase 'studentid' to match database
  const studentAttendance = attendance.filter((r) => r.studentid === studentId);

  // Group by classid and session
  const attendanceByClass = {};
  studentAttendance.forEach((r) => {
    // FIX: Using lowercase 'classid'
    if (!attendanceByClass[r.classid]) {
      attendanceByClass[r.classid] = {
        total: 0,
        present: 0,
        absent: 0,
        sessions: new Set(),
      };
    }
    attendanceByClass[r.classid].total++;
    if (r.status === "present") attendanceByClass[r.classid].present++;
    if (r.status === "absent") attendanceByClass[r.classid].absent++;

    // Track unique sessions
    if (r.session) {
      attendanceByClass[r.classid].sessions.add(`${r.date}-${r.session}`);
    }
  });

  const tbody = document.getElementById("studentAttendanceBody");
  tbody.innerHTML = "";

  if (Object.keys(attendanceByClass).length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;">No attendance records found yet.</td></tr>';
    return;
  }

  for (const classId in attendanceByClass) {
    const cls = classes.find((c) => c.id === parseInt(classId));
    if (!cls) continue;

    const stats = attendanceByClass[classId];
    const percentage =
      stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
    const uniqueSessions = stats.sessions.size;

    // FIX: Added color logic for status badge
    const status =
      percentage >= 75
        ? '<span class="status-badge" style="background:#d4edda; color:#155724;">Good</span>'
        : '<span class="status-badge" style="background:#f8d7da; color:#721c24;">Low</span>';

    const row = document.createElement("tr");
    row.innerHTML = `
                    <td>${cls.name} (${cls.code})</td>
                    <td>${cls.faculty}</td>
                    <td>${stats.total} (${uniqueSessions} sessions)</td>
                    <td>${stats.present}</td>
                    <td>${percentage}%</td>
                    <td>${status}</td>
                 `;
    tbody.appendChild(row);
  }
}

// Switch faculty tab
// Switch faculty tab (Fixed: Refreshes buttons)
function switchFacultyTab(tab, event) {
  if (event) {
    document
      .querySelectorAll("#facultyPanel .tab-btn")
      .forEach((b) => b.classList.remove("active"));
    event.target.classList.add("active");
  }

  // Hide all tab contents
  document.querySelectorAll("#facultyPanel .tab-content").forEach((content) => {
    content.style.display = "none";
  });

  // Show selected tab
  const selectedTab = document.getElementById(
    "faculty" + tab.charAt(0).toUpperCase() + tab.slice(1),
  );
  if (selectedTab) {
    selectedTab.style.display = "block";
  }

  // Load data/buttons for specific tabs
  if (tab === "history") {
    loadAttendanceHistory();
  } else if (tab === "report") {
    generateYearlyReport();
  } else if (tab === "mark") {
    addMultiSessionButton();
  } else if (tab === "marks") {
    // NEW LOGIC FOR INTERNAL MARKS
    if (typeof populateFacultyMarksDropdown === "function")
      populateFacultyMarksDropdown();
  }
}

// Load attendance history
// Load attendance history (Fixed for Lowercase DB Columns)
// Load attendance history (Fixed: Strict Type Matching Removed)
async function loadAttendanceHistory() {
  const classSelect = document.getElementById("historyClassSelect");
  // Get raw value first, then convert to allow string comparison if needed
  const rawClassId = classSelect.value;
  const dateFilter = document.getElementById("historyDateFilter").value;
  const container = document.getElementById("historyList");

  if (!rawClassId) {
    container.innerHTML =
      '<p style="text-align:center; color:gray;">Please select a class first.</p>';
    return;
  }

  const allAttendance = await getAll("attendance");
  const allClasses = await getAll("classes");
  const allStudents = await getAll("students");

  // FIX: Loose comparison (==) handles string vs int IDs
  const classInfo = allClasses.find((c) => c.id == rawClassId);
  if (!classInfo) {
    console.error("Class info not found for ID:", rawClassId);
    return;
  }

  // FIX: Loose comparison for filtering records
  let classRecords = allAttendance.filter((r) => r.classid == rawClassId);

  if (dateFilter) {
    classRecords = classRecords.filter((r) => r.date === dateFilter);
  }

  // --- RENDERING LOGIC (Same as before) ---
  container.innerHTML = "";

  if (classRecords.length === 0) {
    container.innerHTML =
      '<p style="text-align:center; color:gray;">No attendance records found.</p>';
    return;
  }

  // Group by date
  const dateGroups = {};
  classRecords.forEach((r) => {
    if (!dateGroups[r.date]) dateGroups[r.date] = [];
    dateGroups[r.date].push(r);
  });

  const sortedDates = Object.keys(dateGroups).sort(
    (a, b) => new Date(b) - new Date(a),
  );

  sortedDates.forEach((date) => {
    const recordsForDate = dateGroups[date];
    const sessionGroups = {};
    recordsForDate.forEach((r) => {
      const session = r.session || 1;
      if (!sessionGroups[session]) sessionGroups[session] = [];
      sessionGroups[session].push(r);
    });

    const sortedSessions = Object.keys(sessionGroups).sort((a, b) => a - b);

    // Header
    const formattedDate = new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const dateHeader = document.createElement("div");
    dateHeader.className = "date-header";
    // Inline style fallback
    dateHeader.style.cssText =
      "background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 12px 20px; border-radius: 8px 8px 0 0; margin-top: 20px;";
    dateHeader.innerHTML = `<div><span style="font-size: 16px;">📅 ${formattedDate}</span></div><div style="font-size: 12px;">Total: ${recordsForDate.length}</div>`;
    container.appendChild(dateHeader);

    sortedSessions.forEach((sessionNum) => {
      const records = sessionGroups[sessionNum];
      const present = records.filter((r) => r.status === "present").length;
      const absent = records.filter((r) => r.status === "absent").length;

      // Session Header
      const sessionHeader = document.createElement("div");
      sessionHeader.style.cssText =
        "background: rgba(52, 152, 219, 0.1); padding: 15px; border-bottom: 1px solid rgba(52, 152, 219, 0.2); color: #2c5282; display:flex; justify-content:space-between;";
      sessionHeader.innerHTML = `<span>📋 Session ${sessionNum}</span><span>✅ ${present} | ❌ ${absent}</span>`;
      container.appendChild(sessionHeader);

      // Table
      const sessionContent = document.createElement("div");
      sessionContent.innerHTML = `<table style="width:100%; font-size:13px; border-collapse: collapse;"><tbody id="rec-${date}-${sessionNum}"></tbody></table>`;
      container.appendChild(sessionContent);

      const tbody = sessionContent.querySelector("tbody");

      // Sort by roll no
      records.sort((a, b) => {
        const sA = allStudents.find((s) => s.id == a.studentid) || {};
        const sB = allStudents.find((s) => s.id == b.studentid) || {};
        return (sA.rollno || "").localeCompare(sB.rollno || "");
      });

      records.forEach((r) => {
        const s = allStudents.find((st) => st.id == r.studentid) || {};
        const row = document.createElement("tr");
        row.style.borderBottom = "1px solid #eee";
        const statusColor = r.status === "present" ? "#d4edda" : "#f8d7da";
        const statusText = r.status === "present" ? "✅ Present" : "❌ Absent";

        row.innerHTML = `
            <td style="padding:8px;">${s.firstname || ""} ${
              s.lastname || ""
            }</td>
            <td style="padding:8px;">${s.rollno || "N/A"}</td>
            <td style="padding:8px;"><span style="background:${statusColor}; padding:4px 8px; border-radius:4px;">${statusText}</span></td>
            <td style="padding:8px;"><button class="btn btn-small btn-info" onclick="openEditAttendanceModal(${
              r.id
            })">✏️</button></td>
          `;
        tbody.appendChild(row);
      });
    });
  });
}

// Export date attendance
async function exportDateAttendance(date, classId) {
  const allAttendance = await getAll("attendance");
  const allStudents = await getAll("students");
  const allClasses = await getAll("classes");

  const classInfo = allClasses.find((c) => c.id === classId);
  if (!classInfo) return;

  const dateRecords = allAttendance.filter(
    (r) => r.classId === classId && r.date === date,
  );

  if (dateRecords.length === 0) {
    showToast("No records found for this date", "info");
    return;
  }

  // Group by session
  const sessions = {};
  dateRecords.forEach((r) => {
    const session = r.session || 1;
    if (!sessions[session]) {
      sessions[session] = [];
    }
    sessions[session].push(r);
  });

  let csvContent = `Attendance Export - ${classInfo.code}: ${classInfo.name}\n`;
  csvContent += `Date: ${date}\n\n`;

  // Sort sessions numerically
  const sortedSessions = Object.keys(sessions).sort((a, b) => a - b);

  sortedSessions.forEach((sessionNum) => {
    csvContent += `Session ${sessionNum}\n`;
    csvContent += "Roll No,Name,Status\n";

    const sessionRecords = sessions[sessionNum];
    sessionRecords.forEach((r) => {
      const student = allStudents.find((s) => s.id === r.studentId) || {};
      csvContent += `${student.rollNo || "N/A"},"${student.firstName || ""} ${
        student.lastName || ""
      }",${r.status}\n`;
    });

    csvContent += "\n"; // Blank line between sessions
  });

  // Add summary
  csvContent += "Summary\n";
  csvContent += "Session,Total,Present,Absent,Percentage\n";

  sortedSessions.forEach((sessionNum) => {
    const sessionRecords = sessions[sessionNum];
    const total = sessionRecords.length;
    const present = sessionRecords.filter((r) => r.status === "present").length;
    const absent = sessionRecords.filter((r) => r.status === "absent").length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    csvContent += `${sessionNum},${total},${present},${absent},${percentage}%\n`;
  });

  // Use downloadCSV which will convert to ASCII
  downloadCSV(
    csvContent,
    `attendance_${classInfo.code}_${date.replace(/-/g, "")}.csv`,
  );
  showToast(`Exported attendance for ${date}`, "success");
}

// Download history CSV
// Download history CSV (Fixed for Lowercase DB Columns)
async function downloadHistoryCSV() {
  const classSelect = document.getElementById("historyClassSelect");
  const classId = parseInt(classSelect.value);
  const dateFilter = document.getElementById("historyDateFilter").value;

  if (!classId) {
    showToast("Please select a class first", "error");
    return;
  }

  const allAttendance = await getAll("attendance");
  const allStudents = await getAll("students");
  const allClasses = await getAll("classes");

  const classInfo = allClasses.find((c) => c.id === classId);
  if (!classInfo) return;

  // FIX: Using lowercase 'classid'
  let classRecords = allAttendance.filter((r) => r.classid === classId);

  // Apply date filter if specified
  if (dateFilter) {
    classRecords = classRecords.filter((r) => r.date === dateFilter);
  }

  if (classRecords.length === 0) {
    showToast("No history found for this class", "info");
    return;
  }

  // Group by date first, then by session
  const dateGroups = {};
  classRecords.forEach((r) => {
    if (!dateGroups[r.date]) {
      dateGroups[r.date] = [];
    }
    dateGroups[r.date].push(r);
  });

  // Sort dates in descending order (most recent first)
  const sortedDates = Object.keys(dateGroups).sort(
    (a, b) => new Date(b) - new Date(a),
  );

  let csvContent = "";

  csvContent +=
    "==================================================================\n";
  csvContent += `ATTENDANCE HISTORY - ${classInfo.code}: ${classInfo.name}\n`;
  csvContent += `Department: ${classInfo.department}, Semester: ${classInfo.semester}\n`;
  csvContent += `Faculty: ${classInfo.faculty}\n`;

  if (dateFilter) {
    csvContent += `Filtered Date: ${new Date(dateFilter).toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    )}\n`;
  }

  csvContent += `Total Records: ${classRecords.length}\n`;
  csvContent +=
    "==================================================================\n\n";

  // Process each date
  sortedDates.forEach((currentDate, dateIndex) => {
    const recordsForDate = dateGroups[currentDate];

    // Group by session within this date
    const sessionGroups = {};
    recordsForDate.forEach((r) => {
      const session = r.session || 1;
      if (!sessionGroups[session]) {
        sessionGroups[session] = [];
      }
      sessionGroups[session].push(r);
    });

    // Sort sessions numerically
    const sortedSessions = Object.keys(sessionGroups).sort((a, b) => a - b);

    // Format date nicely
    const formattedDate = new Date(currentDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    csvContent += `Date: ${formattedDate} (${sortedSessions.length} session${
      sortedSessions.length > 1 ? "s" : ""
    })\n`;
    csvContent += "=".repeat(70) + "\n";

    // Process each session for this date
    sortedSessions.forEach((sessionNum) => {
      const recordsForSession = sessionGroups[sessionNum];

      csvContent += `   Session ${sessionNum}\n`;
      csvContent += "   " + "-".repeat(60) + "\n";
      csvContent += "   Roll No,Student Name,Status,Time Recorded\n";

      // Sort records by roll number
      recordsForSession.sort((a, b) => {
        // FIX: Using lowercase 'studentid'
        const studentA = allStudents.find((s) => s.id === a.studentid) || {};
        const studentB = allStudents.find((s) => s.id === b.studentid) || {};
        // FIX: Using lowercase 'rollno'
        return (studentA.rollno || "").localeCompare(studentB.rollno || "");
      });

      recordsForSession.forEach((record) => {
        // FIX: Using lowercase 'studentid'
        const student =
          allStudents.find((s) => s.id === record.studentid) || {};
        const statusText = record.status === "present" ? "P" : "A";

        // FIX: Using lowercase 'createdat'
        const timeRecorded = record.createdat
          ? new Date(record.createdat).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "N/A";

        // FIX: Using lowercase 'rollno', 'firstname', 'lastname'
        csvContent += `   ${student.rollno || "N/A"},"${
          student.firstname || ""
        } ${student.lastname || ""}",${statusText},${timeRecorded}\n`;
      });

      // Calculate session totals
      const total = recordsForSession.length;
      const present = recordsForSession.filter(
        (r) => r.status === "present",
      ).length;
      const absent = recordsForSession.filter(
        (r) => r.status === "absent",
      ).length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      csvContent += `   -- Session ${sessionNum} Summary: ${present} Present | ${absent} Absent | ${percentage}% --\n\n`;
    });

    // Calculate date-wide totals
    let dateTotal = 0;
    let datePresent = 0;
    let dateAbsent = 0;
    recordsForDate.forEach((r) => {
      dateTotal++;
      if (r.status === "present") datePresent++;
      else if (r.status === "absent") dateAbsent++;
    });
    const datePercentage =
      dateTotal > 0 ? Math.round((datePresent / dateTotal) * 100) : 0;

    csvContent += `   Date Summary: ${datePresent} Present | ${dateAbsent} Absent | ${datePercentage}% Attendance\n`;

    if (dateIndex < sortedDates.length - 1) {
      csvContent += "=".repeat(70) + "\n\n";
    } else {
      csvContent += "\n";
    }
  });

  // Add overall summary
  const overallTotal = classRecords.length;
  const overallPresent = classRecords.filter(
    (r) => r.status === "present",
  ).length;
  const overallAbsent = classRecords.filter(
    (r) => r.status === "absent",
  ).length;
  const overallPercentage =
    overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;

  csvContent +=
    "==================================================================\n";
  csvContent += "OVERALL SUMMARY\n";
  csvContent +=
    "==================================================================\n";
  csvContent += `Total Records: ${overallTotal}\n`;
  csvContent += `Total Present: ${overallPresent}\n`;
  csvContent += `Total Absent: ${overallAbsent}\n`;
  csvContent += `Overall Attendance: ${overallPercentage}%\n`;
  csvContent += `Export Date: ${new Date().toLocaleString()}\n`;

  let filename = `attendance_history_${classInfo.code}`;
  if (dateFilter) {
    const datePart = dateFilter.replace(/-/g, "");
    filename += `_${datePart}`;
  } else {
    filename += "_all_dates";
  }
  filename += `_${new Date().getTime()}.csv`;

  downloadCSV(csvContent, filename);
  showToast("Exported history successfully", "success");
}

// Generate yearly report
// =============================================
// FACULTY YEAR-WISE DETAILED REPORT
// =============================================

async function generateYearlyReport() {
  const tbody = document.getElementById("yearWiseAttendanceBody");

  // Safety check if element exists
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="6" style="text-align:center; padding: 20px;">Loading comprehensive report...</td></tr>';

  // 1. Identify Current Faculty
  // Uses loose check in case currentUser isn't fully populated, falls back to auth check
  if (!currentUser || currentUser.role !== "faculty") {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center; color:red;">Error: You must be logged in as Faculty to view this.</td></tr>';
    return;
  }

  const facultyName = `${currentUser.firstname} ${currentUser.lastname}`;

  // 2. Fetch All Data
  const [allAttendance, allClasses, allStudents] = await Promise.all([
    getAll("attendance"),
    getAll("classes"),
    getAll("students"),
  ]);

  // 3. Find Classes Taught by This Faculty
  // Normalizing strings to ensure matches (trim + lowercase check)
  const myClasses = allClasses.filter(
    (c) => c.faculty.trim().toLowerCase() === facultyName.trim().toLowerCase(),
  );

  if (myClasses.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center; padding: 20px;">No classes assigned to you yet.</td></tr>';
    return;
  }

  // 4. Sort Classes by Year (Ascending)
  myClasses.sort((a, b) => (a.year || 0) - (b.year || 0));

  let htmlRows = "";

  // 5. Generate Stats for Each Class
  for (const cls of myClasses) {
    // Filter attendance for this specific class
    const classRecords = allAttendance.filter((r) => r.classid === cls.id);

    // A. Total Classes Held (Unique Date + Session combinations)
    const uniqueSessions = new Set(
      classRecords.map((r) => `${r.date}-${r.session}`),
    );
    const totalClassesHeld = uniqueSessions.size;

    // B. Total Students (Count unique student IDs in records OR count distinct students in the batch)
    // Method 1: Students active in attendance
    const activeStudentIds = new Set(classRecords.map((r) => r.studentid));
    // Method 2: Potential students (better for "Strength") -> Match Dept + Sem
    const potentialStudents = allStudents.filter(
      (s) => s.department === cls.department && s.semester == cls.semester,
    );
    const totalStudents =
      potentialStudents.length > 0
        ? potentialStudents.length
        : activeStudentIds.size;

    // C. Average Strength (Average number of 'Present' students per session)
    const totalPresent = classRecords.filter(
      (r) => r.status === "present",
    ).length;

    // Avoid division by zero
    const avgStrength =
      totalClassesHeld > 0 ? Math.round(totalPresent / totalClassesHeld) : 0;

    const attendancePercentage =
      totalClassesHeld > 0 && totalStudents > 0
        ? Math.round((avgStrength / totalStudents) * 100)
        : 0;

    // D. Determine Status Color
    const statusColor =
      attendancePercentage >= 75
        ? "green"
        : attendancePercentage >= 50
          ? "orange"
          : "red";

    // E. Generate Row HTML
    htmlRows += `
          <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px; font-weight: bold;">${
                cls.year || "N/A"
              }</td>
              <td style="padding: 12px;">
                  <div style="font-weight:600; color: #2c3e50;">${
                    cls.name
                  }</div>
                  <div style="font-size:11px; color: #7f8c8d;">${cls.code} • ${
                    cls.department
                  }</div>
              </td>
              <td style="padding: 12px; text-align: center;">${totalStudents}</td>
              <td style="padding: 12px; text-align: center;">${totalClassesHeld}</td>
              <td style="padding: 12px; text-align: center;">
                  ${avgStrength} <span style="font-size:11px; color:#7f8c8d;">/ class</span>
                  <div style="font-size:10px; color:${statusColor}; font-weight:bold;">${attendancePercentage}% Avg</div>
              </td>
              <td style="padding: 12px; text-align: center;">
                   <button class="btn btn-small btn-primary" onclick="downloadSubjectAttendanceReportForId(${
                     cls.id
                   })">
                      📥 Report
                   </button>
              </td>
          </tr>
      `;
  }

  // 6. Update Table Header (Optional, requires matching HTML structure)
  // Ensure your HTML <thead> matches these columns: Year | Subject | Students | Classes Held | Avg Strength | Action

  tbody.innerHTML = htmlRows;
}

// Helper: Download Report for a specific Class ID (Wrapper for button click)
async function downloadSubjectAttendanceReportForId(classId) {
  // Re-use existing export logic but force specific ID
  // We can't use the dropdown value because this button is independent

  // Create a temporary mock of the select element logic
  const allAttendance = await getAll("attendance");
  const allStudents = await getAll("students");
  const allClasses = await getAll("classes");
  const classInfo = allClasses.find((c) => c.id === classId);

  if (!classInfo) {
    showToast("Class info not found", "error");
    return;
  }

  const classRecords = allAttendance.filter((r) => r.classid === classId);

  if (classRecords.length === 0) {
    showToast("No attendance data to export.", "info");
    return;
  }

  // Generate CSV
  let csvLines = [];
  csvLines.push("ACADEMIC ATTENDANCE REPORT");
  csvLines.push(`Faculty: ${classInfo.faculty}`);
  csvLines.push(`Subject: ${classInfo.name} (${classInfo.code})`);
  csvLines.push(`Year: ${classInfo.year}, Semester: ${classInfo.semester}`);
  csvLines.push(`Generated: ${new Date().toLocaleString()}`);
  csvLines.push("");
  csvLines.push("Roll No,Student Name,Total Classes,Present,Absent,Percentage");

  // Group by student
  const studentStats = {};
  classRecords.forEach((r) => {
    if (!studentStats[r.studentid])
      studentStats[r.studentid] = { p: 0, a: 0, total: 0 };
    studentStats[r.studentid].total++;
    if (r.status === "present") studentStats[r.studentid].p++;
    else studentStats[r.studentid].a++;
  });

  Object.keys(studentStats).forEach((sid) => {
    const s = allStudents.find((stu) => stu.id == sid);
    if (s) {
      const stat = studentStats[sid];
      const pct = Math.round((stat.p / stat.total) * 100);
      csvLines.push(
        `${s.rollno},"${s.firstname} ${s.lastname}",${stat.total},${stat.p},${stat.a},${pct}%`,
      );
    }
  });

  // Download
  const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Report_${classInfo.code}_${
    new Date().toISOString().split("T")[0]
  }.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("Report downloaded successfully", "success");
}

// =============================================
// EDIT ATTENDANCE MODAL FUNCTIONS
// =============================================

// Open edit attendance modal
async function openEditAttendanceModal(attendanceId) {
  const record = await getRecord("attendance", attendanceId);
  if (!record) return;

  const allStudents = await getAll("students");
  const allClasses = await getAll("classes");

  const student = allStudents.find((s) => s.id === record.studentId);
  const classInfo = allClasses.find((c) => c.id === record.classId);

  document.getElementById("editAttendanceId").value = attendanceId;
  document.getElementById("editAttendanceStudentId").value = record.studentId;

  document.getElementById("editStudentInfo").textContent = student
    ? `${student.firstName} ${student.lastName} (${student.rollNo})`
    : "Unknown Student";
  document.getElementById("editClassInfo").textContent = classInfo
    ? `${classInfo.code} - ${classInfo.name}`
    : "Unknown Class";
  document.getElementById("editDateInfo").textContent = `${
    record.date
  } (Session ${record.session || 1})`;
  document.getElementById("editFacultyInfo").textContent = classInfo
    ? classInfo.faculty
    : "Unknown Faculty";
  document.getElementById("editAttendanceNotes").value = record.notes || "";

  // Set session selector
  document.getElementById("editSessionSelector").value = record.session || 1;

  // Set the correct radio button
  document.querySelector(
    `input[name="attendanceStatus"][value="${record.status}"]`,
  ).checked = true;

  openModal("editAttendanceModal");
}

// Save edited attendance
async function saveEditedAttendance(event) {
  event.preventDefault();

  const attendanceId = parseInt(
    document.getElementById("editAttendanceId").value,
  );
  const record = await getRecord("attendance", attendanceId);

  if (!record) {
    showToast("Record not found!", "error");
    return;
  }

  const newStatus = document.querySelector(
    'input[name="attendanceStatus"]:checked',
  ).value;
  const notes = document.getElementById("editAttendanceNotes").value;
  const newSession =
    parseInt(document.getElementById("editSessionSelector").value) || 1;

  record.status = newStatus;
  record.notes = notes;
  record.session = newSession;
  record.updatedAt = new Date().toISOString();

  await updateRecord("attendance", record);
  showToast("Attendance updated successfully!");
  closeModal("editAttendanceModal");

  // Refresh the current view
  if (currentUser.role === "faculty") {
    loadAttendanceHistory();
  } else if (currentUser.role === "admin") {
    loadAdminAttendanceHistory();
  }
}

// Delete attendance record
async function deleteAttendanceRecord() {
  const attendanceId = parseInt(
    document.getElementById("editAttendanceId").value,
  );

  showConfirm("Delete this attendance record permanently?", async function () {
    await deleteRecord("attendance", attendanceId);
    showToast("Attendance record deleted!", "info");
    closeModal("editAttendanceModal");

    // Refresh the current view
    if (currentUser.role === "faculty") {
      loadAttendanceHistory();
    } else if (currentUser.role === "admin") {
      loadAdminAttendanceHistory();
    }
  });
}

// Download attendance report
async function downloadAttendanceReport() {
  const classSelect = document.getElementById("facultyClassSelect");
  const classId = parseInt(classSelect.value);
  const date = document.getElementById("attendanceDate").value;

  if (!classId) {
    showToast("Please select a class first", "error");
    return;
  }

  const allAttendance = await getAll("attendance");
  const allStudents = await getAll("students");
  const allClasses = await getAll("classes");

  const classInfo = allClasses.find((c) => c.id === classId);
  if (!classInfo) return;

  let classRecords = allAttendance.filter((r) => r.classId === classId);

  if (date) {
    classRecords = classRecords.filter((r) => r.date === date);
  }

  if (classRecords.length === 0) {
    showToast("No attendance records found for this class", "info");
    return;
  }

  // Group by date then session
  const dateGroups = {};
  classRecords.forEach((r) => {
    if (!dateGroups[r.date]) {
      dateGroups[r.date] = [];
    }
    dateGroups[r.date].push(r);
  });

  // Sort dates in descending order
  const sortedDates = Object.keys(dateGroups).sort(
    (a, b) => new Date(b) - new Date(a),
  );

  // Create CLEAN CSV - SAME FORMAT AS ATTENDANCE HISTORY
  let csvLines = [];
  csvLines.push(
    "==================================================================",
  );
  csvLines.push(`ATTENDANCE REPORT - ${classInfo.code}: ${classInfo.name}`);
  csvLines.push(
    `Department: ${classInfo.department}, Semester: ${classInfo.semester}`,
  );
  csvLines.push(`Faculty: ${classInfo.faculty}`);
  if (date) {
    csvLines.push(`Filtered Date: ${date}`);
  }
  csvLines.push(`Total Records: ${classRecords.length}`);
  csvLines.push(
    "==================================================================",
  );
  csvLines.push("");

  // Summary
  let totalPresent = 0,
    totalAbsent = 0;
  classRecords.forEach((r) => {
    if (r.status === "present") totalPresent++;
    else totalAbsent++;
  });

  csvLines.push("SUMMARY");
  csvLines.push(`Total Records,${classRecords.length}`);
  csvLines.push(`Total Present,${totalPresent}`);
  csvLines.push(`Total Absent,${totalAbsent}`);
  csvLines.push(
    `Overall Attendance %,${
      classRecords.length > 0
        ? Math.round((totalPresent / classRecords.length) * 100)
        : 0
    }`,
  );
  csvLines.push("");
  csvLines.push("");

  // Detailed records by date and session
  sortedDates.forEach((currentDate, dateIndex) => {
    const recordsForDate = dateGroups[currentDate];

    // Group by session
    const sessionGroups = {};
    recordsForDate.forEach((r) => {
      const session = r.session || 1;
      if (!sessionGroups[session]) {
        sessionGroups[session] = [];
      }
      sessionGroups[session].push(r);
    });

    const sortedSessions = Object.keys(sessionGroups).sort((a, b) => a - b);

    // ADD LONG SEPARATOR BEFORE EACH DATE (except first one)
    if (dateIndex > 0) {
      csvLines.push(
        "-------------------------------------------------------------------------------------------------------------",
      );
      csvLines.push("");
    }

    csvLines.push(
      `Date: ${new Date(currentDate).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })} (${sortedSessions.length} session${
        sortedSessions.length > 1 ? "s" : ""
      })`,
    );
    csvLines.push(
      "======================================================================",
    );

    sortedSessions.forEach((sessionNum, sessionIndex) => {
      const sessionRecords = sessionGroups[sessionNum];

      // ADD X SEPARATOR FOR SESSION
      csvLines.push(
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      );
      csvLines.push(`   Session ${sessionNum}`);
      csvLines.push("   " + "-".repeat(60));
      csvLines.push("   Roll No,Student Name,Status,Time Recorded");

      sessionRecords.forEach((record) => {
        const student =
          allStudents.find((s) => s.id === record.studentId) || {};
        const rollNo = String(student.rollNo || "N/A");
        const name = `${student.firstName || ""} ${
          student.lastName || ""
        }`.trim();
        const statusText = record.status === "present" ? "P" : "A";
        const timeRecorded = record.createdAt
          ? new Date(record.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            });
        csvLines.push(`   ${rollNo},"${name}",${statusText},${timeRecorded}`);
      });

      const present = sessionRecords.filter(
        (r) => r.status === "present",
      ).length;
      const absent = sessionRecords.filter((r) => r.status === "absent").length;
      const percentage =
        sessionRecords.length > 0
          ? Math.round((present / sessionRecords.length) * 100)
          : 0;
      csvLines.push(
        `   -- Session ${sessionNum} Summary: ${present} Present | ${absent} Absent | ${percentage}% --`,
      );
      csvLines.push("");
    });

    // Date summary
    const datePresent = recordsForDate.filter(
      (r) => r.status === "present",
    ).length;
    const dateAbsent = recordsForDate.filter(
      (r) => r.status === "absent",
    ).length;
    const datePercentage =
      recordsForDate.length > 0
        ? Math.round((datePresent / recordsForDate.length) * 100)
        : 0;
    csvLines.push(
      `   Date Summary: ${datePresent} Present | ${dateAbsent} Absent | ${datePercentage}% Attendance`,
    );
    csvLines.push(
      "======================================================================",
    );
  });

  csvLines.push("");
  csvLines.push(
    "==================================================================",
  );
  csvLines.push("OVERALL SUMMARY");
  csvLines.push(
    "==================================================================",
  );
  csvLines.push(`Total Dates: ${sortedDates.length}`);
  csvLines.push(
    `Total Sessions: ${Object.values(dateGroups).reduce((sum, records) => {
      const sessions = new Set(records.map((r) => r.session || 1));
      return sum + sessions.size;
    }, 0)}`,
  );
  csvLines.push(`Total Records: ${classRecords.length}`);
  csvLines.push(`Total Present: ${totalPresent}`);
  csvLines.push(`Total Absent: ${totalAbsent}`);
  csvLines.push(
    `Overall Attendance: ${
      classRecords.length > 0
        ? Math.round((totalPresent / classRecords.length) * 100)
        : 0
    }%`,
  );
  csvLines.push(`Export Date: ${new Date().toLocaleString()}`);

  const csvContent = csvLines.join("\n");
  downloadCSV(
    csvContent,
    `attendance_report_${classInfo.code}_${
      date ? date.replace(/-/g, "") : "all"
    }_${new Date().getTime()}.csv`,
  );
  showToast(`Exported ${classRecords.length} attendance records`, "success");
}

// =============================================
// ATTENDANCE MARKING FUNCTIONS
// =============================================

// Add multi-session button
// Add multi-session button (Fixed: Prevents duplicates)
// Add multi-session button (Fixed: robust cleanup)
// Add multi-session button (Fixed: No Duplicates)
function addMultiSessionButton() {
  const existingBtn = document.getElementById("multiSessionBtn");
  if (existingBtn) existingBtn.remove(); // Force remove old one

  const submitButton = document.querySelector("#facultyMark .btn-success");
  if (!submitButton) return;

  const multiSessionBtn = document.createElement("button");
  multiSessionBtn.type = "button";
  multiSessionBtn.className = "btn btn-warning";
  multiSessionBtn.id = "multiSessionBtn";
  multiSessionBtn.textContent = "📅 Mark Multiple Sessions";
  multiSessionBtn.onclick = markMultipleSessions;
  multiSessionBtn.style.cssText = "display:inline-block; margin-left:10px;";

  submitButton.parentNode.insertBefore(
    multiSessionBtn,
    submitButton.nextSibling,
  );
}

// Mark multiple sessions
// Mark multiple sessions (Fixed: Detects existing records)
async function markMultipleSessions() {
  const classId = parseInt(document.getElementById("facultyClassSelect").value);
  const date = document.getElementById("attendanceDate").value;
  const endSession = parseInt(
    document.getElementById("attendanceSession").value,
  );

  if (!classId || !date || endSession < 1) {
    showToast("Please select Class, Date, and Session number", "error");
    return;
  }

  showConfirm(
    `Mark attendance for ${endSession} sessions on ${date}?`,
    async function () {
      const checkboxes = document.querySelectorAll(".attendance-checkbox");
      if (checkboxes.length === 0) {
        showToast("No students to mark", "error");
        return;
      }

      const allAttendance = await getAll("attendance");
      let totalRecords = 0;

      // For each session from 1 to endSession
      for (let session = 1; session <= endSession; session++) {
        // FIX: Using lowercase keys for filtering
        const existingForSession = allAttendance.filter(
          (r) =>
            r.classid === classId && r.date === date && r.session === session,
        );

        // FIX: Map using lowercase 'studentid'
        const existingMap = new Map(
          existingForSession.map((r) => [r.studentid, r]),
        );

        const promises = [];

        checkboxes.forEach((cb) => {
          const studentId = parseInt(cb.value);
          const status = cb.checked ? "present" : "absent";

          // FIX: Lowercase keys for Supabase object
          const record = {
            classid: classId,
            studentid: studentId,
            date: date,
            session: session,
            status: status,
            notes: `Session ${session}`,
            createdat: new Date().toISOString(),
          };

          const existing = existingMap.get(studentId);
          if (existing) {
            record.id = existing.id;
            if (existing.createdat) record.createdat = existing.createdat;
            record.updatedat = new Date().toISOString();
            promises.push(updateRecord("attendance", record));
          } else {
            promises.push(addRecord("attendance", record));
          }
        });

        try {
          await Promise.all(promises);
          totalRecords += promises.length;
        } catch (e) {
          console.error(`Error saving session ${session}:`, e);
        }
      }

      showToast(
        `Attendance saved for ${totalRecords} records across ${endSession} sessions!`,
      );
      if (typeof generateYearlyReport === "function") generateYearlyReport();
    },
  );
}

// Load class students
// attendance.js - Updated loadClassStudents function

// attendance.js - Updated loadClassStudents (Multi-Branch + History Memory)

async function loadClassStudents(dateOverride) {
  const classSelect = document.getElementById("facultyClassSelect");
  const classId = parseInt(classSelect.value);
  const date = dateOverride || document.getElementById("attendanceDate").value;
  const session = parseInt(document.getElementById("attendanceSession").value);

  if (dateOverride)
    document.getElementById("attendanceDate").value = dateOverride;

  if (!classId || !date) {
    document.getElementById("studentGrid").innerHTML = "";
    document.getElementById("studentGridContainer").style.display = "none";
    return;
  }

  // 1. Fetch All Necessary Data
  const [allStudents, allClasses, allAttendance] = await Promise.all([
    getAll("students"),
    getAll("classes"),
    getAll("attendance"),
  ]);

  const selectedClass = allClasses.find((c) => c.id === classId);
  if (!selectedClass) return;

  // --- NEW: MULTI-BRANCH LOGIC ---
  // Split the class departments into an array (e.g., "Civil,Mechanical" -> ["Civil", "Mechanical"])
  const targetDepartments = selectedClass.department.split(",");

  // 2. Get "Standard" Batch Students
  // (Match Semester AND belong to ANY of the target departments)
  const standardStudents = allStudents.filter(
    (s) =>
      s.semester == selectedClass.semester &&
      targetDepartments.includes(s.department),
  );

  // 3. Get "History" Students (Anyone previously marked in this class)
  // This ensures electives/backlog students stick to the list once added manually.
  const historyRecords = allAttendance.filter((r) => r.classid == classId);
  const historyStudentIds = new Set(historyRecords.map((r) => r.studentid));
  const historyStudents = allStudents.filter((s) =>
    historyStudentIds.has(s.id),
  );

  // 4. Merge Lists (Standard + History) & Remove Duplicates
  const studentMap = new Map();

  // Add standard batch first
  standardStudents.forEach((s) => studentMap.set(s.id, s));

  // Add history students (this adds missing electives)
  historyStudents.forEach((s) => studentMap.set(s.id, s));

  // Convert back to array and Sort by Roll No
  const finalStudentList = Array.from(studentMap.values());
  finalStudentList.sort((a, b) =>
    (a.rollno || "").localeCompare(b.rollno || ""),
  );

  // 5. Get Attendance Status for the CURRENT Session (to show green/red toggle)
  const currentSessionRecords = allAttendance.filter(
    (r) => r.classid == classId && r.date === date && r.session == session,
  );
  const statusMap = new Map(
    currentSessionRecords.map((r) => [r.studentid, r.status]),
  );

  // 6. Render the Grid
  const grid = document.getElementById("studentGrid");
  grid.innerHTML = "";

  if (finalStudentList.length === 0) {
    grid.innerHTML =
      '<p style="text-align:center; width:100%;">No students found for this class criteria.</p>';
  }

  finalStudentList.forEach((student) => {
    // If record exists for today, use it. If not, default to 'absent' (unmarked)
    const status = statusMap.get(student.id) || "absent";

    // Render the card (isChecked = true if status is 'present')
    renderStudentCard(student, status === "present");
  });

  document.getElementById("studentGridContainer").style.display = "block";
  document.getElementById("currentSessionDisplay").textContent = session;
}

// Submit attendance
// Submit attendance (Fixed: Detects existing records correctly)
// Submit attendance (Fixed: Correctly updates existing records)
async function submitAttendance() {
  const classSelect = document.getElementById("facultyClassSelect");
  const classId = parseInt(classSelect.value);
  const date = document.getElementById("attendanceDate").value;
  const session = parseInt(document.getElementById("attendanceSession").value);

  if (!classId || !date || !session) {
    showToast("Please select Class, Date, and Session", "error");
    return;
  }

  const checkboxes = document.querySelectorAll(".attendance-checkbox");
  if (checkboxes.length === 0) {
    showToast("No students to mark", "error");
    return;
  }

  // 1. Fetch all attendance to check for duplicates
  const allAttendance = await getAll("attendance");

  // FIX: Using lowercase keys (classid, date, session) to find existing records
  const existingForSession = allAttendance.filter(
    (r) => r.classid === classId && r.date === date && r.session === session,
  );

  // FIX: Map using lowercase 'studentid' for quick lookup
  const existingMap = new Map(existingForSession.map((r) => [r.studentid, r]));

  const promises = [];

  checkboxes.forEach((cb) => {
    const studentId = parseInt(cb.value);
    const status = cb.checked ? "present" : "absent";

    // FIX: Object keys must be lowercase for Supabase
    const record = {
      classid: classId,
      studentid: studentId,
      date: date,
      session: session,
      status: status,
      notes: `Session ${session}`,
      createdat: new Date().toISOString(),
    };

    // Check if we already have a record for this student
    const existing = existingMap.get(studentId);

    if (existing) {
      // ✅ UPDATE existing record (Attach the ID)
      record.id = existing.id;
      // Keep original created date, update the modified date
      if (existing.createdat) record.createdat = existing.createdat;
      record.updatedat = new Date().toISOString();

      promises.push(updateRecord("attendance", record));
    } else {
      // ✅ CREATE new record
      promises.push(addRecord("attendance", record));
    }
  });

  try {
    await Promise.all(promises);
    showToast(
      `Attendance saved for ${checkboxes.length} students in Session ${session}!`,
    );
    if (typeof generateYearlyReport === "function") generateYearlyReport();

    // Optional: Uncheck boxes after saving
    // checkboxes.forEach((cb) => (cb.checked = false));
  } catch (e) {
    console.error(e);
    showToast("Error saving attendance", "error");
  }
}

// =============================================
// BULK ATTENDANCE FUNCTIONS
// =============================================

// Open bulk attendance modal
function openBulkAttendanceModal() {
  const classSelect = document.getElementById("facultyClassSelect");
  if (!classSelect.value) {
    showToast("Please select a class first!", "error");
    return;
  }
  document.getElementById("bulkAttendanceInput").value = "";
  openModal("bulkAttendanceModal");
}

// Save bulk attendance
// Save bulk attendance (Fixed for Lowercase DB Columns)
// Save bulk attendance (Fixed: Supports Multiple Sessions)
// Save bulk attendance (Fixed: Robust RollNo Matching & Logging)
async function saveBulkAttendance() {
  const classId = document.getElementById("facultyClassSelect").value;
  if (!classId) return;

  const date = document.getElementById("attendanceDate").value;
  if (!date) {
    showToast("Please select a date first", "error");
    return;
  }

  // Get session info
  const maxSessions =
    parseInt(document.getElementById("attendanceSession").value) || 1;
  const targetSession =
    parseInt(document.getElementById("bulkAttendanceSession").value) || 1;

  const input = document.getElementById("bulkAttendanceInput").value;
  const lines = input.split(/\r\n|\n|\r/);

  // Parse input
  const parsedData = [];
  lines.forEach((line) => {
    if (!line.trim()) return;
    const parts = line.split(",").map((s) => s.trim());
    const rollNo = parts[0];
    const statusKey = parts.length > 1 ? parts[1].toUpperCase() : "P";
    const status = statusKey === "A" ? "absent" : "present";

    if (rollNo) parsedData.push({ rollNo, status });
  });

  if (parsedData.length === 0) {
    showToast("No valid data found in text area", "error");
    return;
  }

  // Ask to apply to all sessions
  let applyToAll = false;
  if (maxSessions > 1) {
    applyToAll = confirm(
      `You have ${maxSessions} sessions active.\nClick OK to apply to ALL sessions (1-${maxSessions}).\nClick CANCEL to save only for Session ${targetSession}.`,
    );
  }

  // Fetch Data
  const allStudents = await getAll("students");
  const allAttendance = await getAll("attendance");

  let successCount = 0;
  let sessionsProcessed = 0;

  const startLoop = applyToAll ? 1 : targetSession;
  const endLoop = applyToAll ? maxSessions : targetSession;

  // Process Sessions
  for (
    let currentSession = startLoop;
    currentSession <= endLoop;
    currentSession++
  ) {
    sessionsProcessed++;

    const existingForSession = allAttendance.filter(
      (r) =>
        r.classid == classId && r.date === date && r.session == currentSession,
    );
    const existingMap = new Map(
      existingForSession.map((r) => [r.studentid, r]),
    );

    const promises = [];

    for (let item of parsedData) {
      // FIX: Loose equality (==) allows string vs number matching
      // Also trims both sides to ensure no whitespace issues
      const student = allStudents.find(
        (s) => String(s.rollno).trim() == String(item.rollNo).trim(),
      );

      if (student) {
        const record = {
          classid: parseInt(classId), // Ensure numeric
          studentid: student.id,
          date: date,
          session: currentSession,
          status: item.status,
          notes: `Session ${currentSession} (Bulk Import)`,
          createdat: new Date().toISOString(),
        };

        const existing = existingMap.get(student.id);

        if (existing) {
          record.id = existing.id;
          if (existing.createdat) record.createdat = existing.createdat;
          record.updatedat = new Date().toISOString();
          promises.push(updateRecord("attendance", record));
        } else {
          promises.push(addRecord("attendance", record));
        }
      } else {
        console.warn(
          `Skipped: Roll No "${item.rollNo}" not found in database.`,
        );
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      successCount += promises.length;
    }
  }

  showToast(
    `Processed ${successCount} records across ${sessionsProcessed} session(s)`,
    "success",
  );
  closeModal("bulkAttendanceModal");
  if (typeof generateYearlyReport === "function") generateYearlyReport();
}

// =============================================
// STUDENT MANAGEMENT FUNCTIONS
// =============================================

// Add student to session
async function addStudentToSession() {
  const input = document.getElementById("addStudentToSessionInput");
  const rollNo = input.value.trim();
  if (!rollNo) {
    showToast("Please enter a Roll No", "error");
    return;
  }
  const allStudents = await getAll("students");
  const student = allStudents.find((s) => s.rollNo === rollNo);
  if (student) {
    renderStudentCard(student, true);
    showToast(`Added ${student.firstName} to list`, "success");
    input.value = "";
  } else {
    showToast("Student not found with this Roll No", "error");
  }
}

// Add batch to session
async function addBatchToSession() {
  const branch = document.getElementById("addBatchBranch").value;
  const sem = parseInt(document.getElementById("addBatchSem").value);
  if (!branch || !sem) {
    showToast("Please select Branch and Semester", "error");
    return;
  }
  const allStudents = await getAll("students");
  const targetStudents = allStudents.filter(
    (s) => s.department === branch && s.semester === sem,
  );
  if (targetStudents.length === 0) {
    showToast("No students found for this criteria", "error");
    return;
  }
  let addedCount = 0;
  targetStudents.forEach((student) => {
    if (!document.getElementById(`student-card-${student.id}`)) {
      renderStudentCard(student);
      addedCount++;
    }
  });
  if (addedCount > 0) {
    showToast(
      `Added ${addedCount} students from ${branch} - Sem ${sem}`,
      "success",
    );
    document.getElementById("studentGridContainer").style.display = "block";
  } else {
    showToast("All students from this batch are already in the list", "info");
  }
}

// Reset attendance
function resetAttendance() {
  document.querySelectorAll("#studentGrid > div").forEach((el) => {
    el.dataset.status = "absent";
    el.style.borderColor = "transparent";
    el.style.background = "var(--color-light)";
  });
}

// Toggle status
function toggleStatus(element) {
  const statuses = ["absent", "present"];
  const current = element.dataset.status;
  const currentIndex = statuses.indexOf(current);
  const nextStatus = statuses[(currentIndex + 1) % statuses.length];
  element.dataset.status = nextStatus;
  element.style.borderColor = nextStatus === "present" ? "green" : "red";
  element.style.background =
    nextStatus === "present" ? "rgba(39,174,96,0.2)" : "rgba(231,76,60,0.2)";
}

// =============================================
// NEW FUNCTIONS FOR CLICKABLE STUDENT NAMES
// =============================================

// Render student card with clickable name and roll number
// Render student card with clickable name and roll number
// Render student card with Toggle Switch style (Matches Pic 1)
// Render student card with Toggle Switch style (Restores Original Look)
function renderStudentCard(student, isChecked = false) {
  const grid = document.getElementById("studentGrid");

  // Prevent duplicates
  if (document.getElementById(`student-card-${student.id}`)) {
    return;
  }

  const div = document.createElement("div");
  div.id = `student-card-${student.id}`;
  div.className = "student-attendance-card";

  // === RESTORE ORIGINAL CARD STYLING ===
  div.style.padding = "15px";
  div.style.background = "white";
  div.style.border = "1px solid #ddd";
  div.style.borderRadius = "8px";
  div.style.display = "flex";
  div.style.justifyContent = "space-between";
  div.style.alignItems = "center";
  div.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
  div.style.marginBottom = "0"; // Reset any default margin

  // === CORRECT HTML STRUCTURE WITH LOWERCASE VARIABLES ===
  // Uses 'attendance-toggle' class to get the "Present" button look
  div.innerHTML = `
      <div style="text-align:left;">
          <div style="font-weight:bold; color:var(--color-dark); font-size: 15px;">
              ${student.firstname} ${student.lastname}
          </div>
          <div style="font-size:12px; color:var(--color-gray); margin-top: 4px;">
              ${student.rollno}
          </div>
      </div>
      
      <label class="attendance-toggle">
          <input type="checkbox" class="attendance-checkbox" value="${
            student.id
          }" 
                 ${isChecked ? "checked" : ""}>
          <span class="toggle-label">Present</span>
      </label>
  `;

  grid.appendChild(div);
}

// View individual student attendance
// View individual student attendance (Admin Panel)
// View individual student attendance (Admin Panel)
// View individual student attendance (Admin Panel) - Updated with Attended Count
async function viewStudentAttendance(studentId) {
  const allStudents = await getAll("students");
  const student = allStudents.find((s) => s.id === studentId);

  if (!student) {
    if (typeof showToast === "function")
      showToast("Student not found", "error");
    return;
  }

  const fullName = `${student.firstname} ${student.lastname}`;
  const rollNo = student.rollno;

  const allAttendance = await getAll("attendance");
  const allClasses = await getAll("classes");

  // FIX: Using lowercase 'studentid'
  const studentAttendance = allAttendance.filter(
    (r) => r.studentid === studentId,
  );

  const container = document.getElementById("detailAttendanceList");

  if (studentAttendance.length === 0) {
    container.innerHTML =
      "<p style='color: gray; text-align: center; padding: 20px;'>No attendance records found.</p>";
  } else {
    // Group by class
    const classMap = {};
    studentAttendance.forEach((record) => {
      // FIX: Using lowercase 'classid'
      if (!classMap[record.classid]) {
        classMap[record.classid] = { total: 0, present: 0, absent: 0 };
      }
      classMap[record.classid].total++;
      if (record.status === "present") {
        classMap[record.classid].present++;
      } else {
        classMap[record.classid].absent++;
      }
    });

    let html =
      "<div style='display: flex; flex-direction: column; gap: 12px;'>";

    Object.keys(classMap).forEach((classId) => {
      const cls = allClasses.find((c) => c.id == classId);
      const stats = classMap[classId];
      const percentage = Math.round((stats.present / stats.total) * 100);

      const statusColor = percentage >= 75 ? "#27ae60" : "#e74c3c";

      html += `
            <div style='background: white; padding: 12px; border-radius: 6px; border-left: 4px solid ${statusColor}; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);'>
                <div style="flex: 1;">
                    <div style='font-size: 14px; font-weight: bold; color: #2c3e50;'>
                        ${cls ? cls.code : "N/A"}
                    </div>
                    <div style='font-size: 12px; color: #7f8c8d;'>
                        ${cls ? cls.name : "Unknown Class"}
                    </div>
                </div>
                
                <div style='text-align: right; display: flex; align-items: center; gap: 15px;'>
                    <div style='text-align: right;'>
                        <div style='font-size: 13px; font-weight: 600; color: #2c3e50;'>
                            ${stats.present} / ${stats.total}
                        </div>
                        <div style='font-size: 10px; color: #95a5a6; text-transform: uppercase;'>
                            Attended
                        </div>
                    </div>
                    
                    <div style='font-weight: bold; color: ${statusColor}; font-size: 18px; min-width: 45px; text-align: right;'>
                        ${percentage}%
                    </div>
                </div>
            </div>
        `;
    });

    html += "</div>";
    container.innerHTML = html;
  }

  // Update modal header details
  document.getElementById("detailStudentName").textContent = fullName;
  document.getElementById("detailStudentRoll").textContent = rollNo;
  document.getElementById("detailStudentDept").textContent = student.department;
  document.getElementById("detailStudentSem").textContent =
    "Sem " + student.semester;

  openModal("studentAttendanceDetailModal");
}

// Export individual student attendance
async function exportStudentAttendance(
  studentId,
  classId,
  rollNo,
  studentName,
) {
  const [attendance, classes] = await Promise.all([
    getAll("attendance"),
    getAll("classes"),
  ]);

  const currentClass = classes.find((c) => c.id === classId);
  const studentAttendance = attendance.filter(
    (r) => r.studentId === studentId && r.classId === classId,
  );

  if (studentAttendance.length === 0) {
    showToast("No attendance records to export", "info");
    return;
  }

  // Create CSV content
  let csvContent = `"Student Attendance Report"\n`;
  csvContent += `"Student: ${studentName}"\n`;
  csvContent += `"Roll No: ${rollNo}"\n`;
  csvContent += `"Class: ${currentClass.code}: ${currentClass.name}"\n`;
  csvContent += `"Faculty: ${currentClass.faculty}"\n`;
  csvContent += `"Department: ${currentClass.department}, Semester: ${currentClass.semester}"\n\n`;

  csvContent += `"Date","Session","Status","Time Recorded","Notes"\n`;

  studentAttendance.forEach((record) => {
    const time = record.createdAt
      ? new Date(record.createdAt).toLocaleString("en-US")
      : "N/A";
    csvContent += `"${record.date}","${record.session || 1}","${
      record.status
    }","${time}","${record.notes || ""}"\n`;
  });

  // Add summary
  const total = studentAttendance.length;
  const present = studentAttendance.filter(
    (r) => r.status === "present",
  ).length;
  const absent = studentAttendance.filter((r) => r.status === "absent").length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  csvContent += `\n"SUMMARY"\n`;
  csvContent += `"Total Sessions","${total}"\n`;
  csvContent += `"Present","${present}"\n`;
  csvContent += `"Absent","${absent}"\n`;
  csvContent += `"Attendance Percentage","${percentage}%"\n`;
  csvContent += `"Export Date","${new Date().toLocaleString()}"\n`;

  // Download CSV
  downloadCSV(
    csvContent,
    `attendance_${rollNo}_${currentClass.code}_${new Date().getTime()}.csv`,
  );
  showToast(`Exported ${total} attendance records for ${rollNo}`, "success");
}

// Helper function to safely escape HTML
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// =============================================
// INITIALIZATION
// =============================================

// Initialize attendance module
document.addEventListener("DOMContentLoaded", function () {
  // Add multi-session button when faculty tab is loaded
  setTimeout(() => {
    addMultiSessionButton();
  }, 500);
});

// =========================================================

//Subject wise Attendance report
// =========================================================

// Subject wise Attendance report (Fixed for Lowercase DB Columns)
async function downloadSubjectAttendanceReport() {
  const classSelect = document.getElementById("historyClassSelect");
  const classId = parseInt(classSelect.value);

  if (!classId) {
    showToast("Please select a class first", "error");
    return;
  }

  const allAttendance = await getAll("attendance");
  const allStudents = await getAll("students");
  const allClasses = await getAll("classes");
  const classInfo = allClasses.find((c) => c.id === classId);

  if (!classInfo) return;

  // FIX: Using lowercase 'classid'
  let classRecords = allAttendance.filter((r) => r.classid === classId);

  if (classRecords.length === 0) {
    showToast("No attendance records for this class", "info");
    return;
  }

  // Group attendance by student
  const studentMap = {};
  classRecords.forEach((record) => {
    // FIX: Using lowercase 'studentid'
    if (!studentMap[record.studentid]) {
      studentMap[record.studentid] = { total: 0, present: 0, absent: 0 };
    }
    studentMap[record.studentid].total++;
    if (record.status === "present") {
      studentMap[record.studentid].present++;
    } else {
      studentMap[record.studentid].absent++;
    }
  });

  let csvLines = [];
  csvLines.push("SUBJECT ATTENDANCE REPORT");
  csvLines.push("");
  csvLines.push(`Subject: ${classInfo.code} - ${classInfo.name}`);
  csvLines.push(`Department: ${classInfo.department}`);
  csvLines.push(`Semester: ${classInfo.semester}`);
  csvLines.push(`Faculty: ${classInfo.faculty}`);
  csvLines.push(`Report Generated: ${new Date().toLocaleString()}`);
  csvLines.push("");
  csvLines.push("STUDENT ATTENDANCE SUMMARY");
  csvLines.push("");
  csvLines.push(
    "Roll No,Student Name,Total Classes,Attended,Absent,Attendance %,Status",
  );

  let totalStudents = 0;
  let totalPresent = 0;
  let totalAbsent = 0;
  let above75 = 0;
  let below75 = 0;

  // Sort students by roll number
  const sortedStudentIds = Object.keys(studentMap).sort((a, b) => {
    const studentA = allStudents.find((s) => s.id == a);
    const studentB = allStudents.find((s) => s.id == b);
    // FIX: Using lowercase 'rollno'
    return (studentA?.rollno || "").localeCompare(studentB?.rollno || "");
  });

  sortedStudentIds.forEach((studentId) => {
    const student = allStudents.find((s) => s.id == studentId);
    if (!student) return;

    const stats = studentMap[studentId];
    const percentage = Math.round((stats.present / stats.total) * 100);
    const status = percentage >= 75 ? "Above 75%" : "Below 75%";

    totalStudents++;
    totalPresent += stats.present;
    totalAbsent += stats.absent;
    if (percentage >= 75) above75++;
    else below75++;

    // FIX: Using lowercase 'rollno', 'firstname', 'lastname'
    csvLines.push(
      `${student.rollno},${student.firstname} ${student.lastname},${stats.total},${stats.present},${stats.absent},${percentage}%,${status}`,
    );
  });

  // Add summary
  csvLines.push("");
  csvLines.push("SUMMARY STATISTICS");
  csvLines.push(`Total Students,${totalStudents}`);
  csvLines.push(
    `Total Classes Held,${classRecords.length / totalStudents || 0}`,
  );
  csvLines.push(`Total Attendance Records,${classRecords.length}`);
  csvLines.push(`Total Present,${totalPresent}`);
  csvLines.push(`Total Absent,${totalAbsent}`);
  csvLines.push(
    `Overall Attendance %,${
      classRecords.length > 0
        ? Math.round((totalPresent / classRecords.length) * 100)
        : 0
    }%`,
  );
  csvLines.push(`Students Above 75%,${above75}`);
  csvLines.push(`Students Below 75%,${below75}`);

  const csvContent = csvLines.join("\n");
  const filename = `SubjectAttendance_${
    classInfo.code
  }_${new Date().getTime()}.csv`;
  downloadCSV(csvContent, filename);

  showToast(`Downloaded ${classInfo.code} attendance report`, "success");
}

// =============================================
// ADMIN ATTENDANCE REPORT FUNCTIONS
// =============================================

async function loadAdminAttendanceHistory() {
  const tbody = document.getElementById("adminAttendanceBody");
  tbody.innerHTML =
    '<tr><td colspan="10" style="text-align:center; padding:20px;">Loading records...</td></tr>';

  // 1. Get Filter Values
  const yearFilter = document.getElementById("adminYearFilter").value;
  const branchFilter = document.getElementById("adminBranchFilter").value;
  const semesterFilter = document.getElementById("adminSemesterFilter").value;
  const classFilter = document.getElementById("adminClassFilter").value;

  let dateType = "all";
  const dateRadio = document.querySelector(
    'input[name="dateFilterType"]:checked',
  );
  if (dateRadio) dateType = dateRadio.value;

  const dateFrom = document.getElementById("adminDateFrom").value;
  const dateTo = document.getElementById("adminDateTo").value;
  const statusFilter = document.getElementById("adminStatusFilter").value;
  const sortBy = document.getElementById("adminSortBy").value;

  // 2. Fetch All Data
  const [allAttendance, allStudents, allClasses] = await Promise.all([
    getAll("attendance"),
    getAll("students"),
    getAll("classes"),
  ]);

  // 3. Filter Attendance
  let filteredAttendance = allAttendance;

  if (dateType === "range") {
    if (dateFrom)
      filteredAttendance = filteredAttendance.filter((r) => r.date >= dateFrom);
    if (dateTo)
      filteredAttendance = filteredAttendance.filter((r) => r.date <= dateTo);
  }

  if (statusFilter !== "all") {
    filteredAttendance = filteredAttendance.filter(
      (r) => r.status === statusFilter,
    );
  }

  // 4. Process Student Stats
  const studentStats = new Map();

  allStudents.forEach((student) => {
    let isValidStudent = true;
    const studentYear = Math.ceil(student.semester / 2);

    if (yearFilter !== "all" && studentYear != yearFilter)
      isValidStudent = false;
    if (branchFilter !== "all" && student.department !== branchFilter)
      isValidStudent = false;
    if (semesterFilter !== "all" && student.semester != semesterFilter)
      isValidStudent = false;

    if (isValidStudent) {
      studentStats.set(student.id, {
        student: student,
        total: 0,
        present: 0,
        absent: 0,
        classIds: new Set(),
      });
    }
  });

  filteredAttendance.forEach((record) => {
    if (classFilter !== "all" && record.classid != classFilter) return;

    if (studentStats.has(record.studentid)) {
      const stats = studentStats.get(record.studentid);
      stats.total++;
      if (record.status === "present") stats.present++;
      else stats.absent++;
      stats.classIds.add(record.classid);
    }
  });

  let reportData = Array.from(studentStats.values());
  if (classFilter !== "all" || dateType === "range") {
    reportData = reportData.filter((item) => item.total > 0);
  }

  // 5. Sort
  reportData.sort((a, b) => {
    const pctA = a.total > 0 ? a.present / a.total : 0;
    const pctB = b.total > 0 ? b.present / b.total : 0;

    switch (sortBy) {
      case "percentage_desc":
        return pctB - pctA;
      case "percentage_asc":
        return pctA - pctB;
      case "rollno_asc":
        return (a.student.rollno || "").localeCompare(b.student.rollno || "");
      case "rollno_desc":
        return (b.student.rollno || "").localeCompare(a.student.rollno || "");
      case "name_asc":
        return (a.student.firstname || "").localeCompare(
          b.student.firstname || "",
        );
      case "name_desc":
        return (b.student.firstname || "").localeCompare(
          a.student.firstname || "",
        );
      default:
        return 0;
    }
  });

  // 6. Render
  tbody.innerHTML = "";

  if (reportData.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="10" style="text-align:center; padding:20px;">No records found matching these filters.</td></tr>';
    updateAdminStats(0, 0, 0, 0);
    return;
  }

  reportData.forEach((item) => {
    const s = item.student;
    const percentage =
      item.total > 0 ? Math.round((item.present / item.total) * 100) : 0;

    const classNames = Array.from(item.classIds)
      .map((cid) => {
        const cls = allClasses.find((c) => c.id === cid);
        return cls ? cls.code : "Unknown";
      })
      .join(", ");

    const tr = document.createElement("tr");

    // FIX: Added onclick to Name column (using span instead of 'a' tag)
    tr.innerHTML = `
      <td>${s.rollno}</td>
      <td>
        <span onclick="viewStudentAttendance(${s.id})" 
              style="cursor:pointer; color:var(--color-primary); font-weight:bold; text-decoration:underline;">
            ${s.firstname} ${s.lastname}
        </span>
      </td>
      <td>${s.department}</td>
      <td>${s.year}</td>
      <td>${s.semester}</td>
      <td><div style="font-size:11px; max-width:150px; overflow:hidden; text-overflow:ellipsis;">${
        classNames || "-"
      }</div></td>
      <td>${item.total}</td>
      <td>${item.present}</td>
      <td>${item.absent}</td>
      <td>
        <span class="status-badge" style="background:${
          percentage >= 75 ? "#d4edda" : "#f8d7da"
        }; color:${percentage >= 75 ? "#155724" : "#721c24"}">
          ${percentage}%
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 7. Stats
  let totalStudents = reportData.length;
  let sumPercentage = 0;
  let above75 = 0;
  let below75 = 0;

  reportData.forEach((item) => {
    const pct = item.total > 0 ? (item.present / item.total) * 100 : 0;
    sumPercentage += pct;
    if (pct >= 75) above75++;
    else below75++;
  });

  const avgPct =
    totalStudents > 0 ? Math.round(sumPercentage / totalStudents) : 0;
  updateAdminStats(totalStudents, avgPct, above75, below75);
}

// Helper to update stats UI
function updateAdminStats(total, avg, above, below) {
  document.getElementById("statTotalRecords").textContent = total;
  document.getElementById("statAvgPercentage").textContent = avg + "%";
  document.getElementById("statAbove75").textContent = above;
  document.getElementById("statBelow75").textContent = below;
  document.getElementById("adminRecordCount").textContent = `(${total})`;
}

// Function to clear filters
function clearAdminFilters() {
  document.getElementById("adminYearFilter").value = "all";
  document.getElementById("adminBranchFilter").value = "all";
  document.getElementById("adminSemesterFilter").value = "all";
  document.getElementById("adminClassFilter").value = "all";

  const allDateRadio = document.querySelector(
    'input[name="dateFilterType"][value="all"]',
  );
  if (allDateRadio) {
    allDateRadio.checked = true;
    if (typeof toggleDateRange === "function") toggleDateRange();
  }

  document.getElementById("adminDateFrom").value = "";
  document.getElementById("adminDateTo").value = "";
  document.getElementById("adminStatusFilter").value = "all";
  document.getElementById("adminSortBy").value = "percentage_desc";

  showToast("Filters cleared", "info");
}
// =============================================
// CSV DOWNLOAD HELPER FUNCTION
// =============================================

function downloadCSV(csv, filename) {
  const csvFile = new Blob([csv], { type: "text/csv" });
  const downloadLink = document.createElement("a");

  // Create a link to the file
  downloadLink.download = filename;
  downloadLink.href = window.URL.createObjectURL(csvFile);
  downloadLink.style.display = "none";

  // Add the link to DOM, click it, and remove it
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

// =============================================
// ADMIN EXPORT FUNCTIONS
// =============================================

// =============================================
// ADMIN EXPORT FUNCTIONS (Updated with Headers)
// =============================================

async function exportAdminHistory(format) {
  if (typeof downloadCSV !== "function") {
    console.error("downloadCSV function is missing!");
    showToast("Export failed: Helper function missing", "error");
    return;
  }

  showToast(`Preparing ${format.toUpperCase()} export...`, "info");

  // 1. Get Filter Values
  const yearFilter = document.getElementById("adminYearFilter").value;
  const branchFilter = document.getElementById("adminBranchFilter").value;
  const semesterFilter = document.getElementById("adminSemesterFilter").value;
  const classFilter = document.getElementById("adminClassFilter").value;

  let dateType = "all";
  const dateRadio = document.querySelector(
    'input[name="dateFilterType"]:checked',
  );
  if (dateRadio) dateType = dateRadio.value;

  const dateFrom = document.getElementById("adminDateFrom").value;
  const dateTo = document.getElementById("adminDateTo").value;
  const statusFilter = document.getElementById("adminStatusFilter").value;

  try {
    // 2. Fetch Data
    const [allAttendance, allStudents, allClasses] = await Promise.all([
      getAll("attendance"),
      getAll("students"),
      getAll("classes"),
    ]);

    // 3. Filter Attendance
    let filteredAttendance = allAttendance;

    if (dateType === "range") {
      if (dateFrom)
        filteredAttendance = filteredAttendance.filter(
          (r) => r.date >= dateFrom,
        );
      if (dateTo)
        filteredAttendance = filteredAttendance.filter((r) => r.date <= dateTo);
    }

    if (statusFilter !== "all") {
      filteredAttendance = filteredAttendance.filter(
        (r) => r.status === statusFilter,
      );
    }

    // 4. Process Student Stats
    const studentStats = new Map();

    allStudents.forEach((student) => {
      let isValidStudent = true;
      const studentYear = Math.ceil(student.semester / 2);

      if (yearFilter !== "all" && studentYear != yearFilter)
        isValidStudent = false;
      if (branchFilter !== "all" && student.department !== branchFilter)
        isValidStudent = false;
      if (semesterFilter !== "all" && student.semester != semesterFilter)
        isValidStudent = false;

      if (isValidStudent) {
        studentStats.set(student.id, {
          student: student,
          total: 0,
          present: 0,
          absent: 0,
          classIds: new Set(),
        });
      }
    });

    filteredAttendance.forEach((record) => {
      // FIX: Lowercase 'classid'
      if (classFilter !== "all" && record.classid != classFilter) return;

      // FIX: Lowercase 'studentid'
      if (studentStats.has(record.studentid)) {
        const stats = studentStats.get(record.studentid);
        stats.total++;
        if (record.status === "present") stats.present++;
        else stats.absent++;
        stats.classIds.add(record.classid);
      }
    });

    // Final Report Data
    let reportData = Array.from(studentStats.values());
    if (classFilter !== "all" || dateType === "range") {
      reportData = reportData.filter((item) => item.total > 0);
    }

    // 5. Generate Dynamic Header
    let headerText = "";
    let selectedClass = null;

    if (classFilter !== "all") {
      selectedClass = allClasses.find((c) => c.id == classFilter);
    }

    if (selectedClass) {
      // Specific Class Header
      headerText +=
        "==================================================================\n";
      headerText += `ATTENDANCE HISTORY - ${selectedClass.code}: ${selectedClass.name}\n`;
      headerText += `Department: ${selectedClass.department}\tSemester: ${selectedClass.semester}\n`;
      headerText += `Faculty: ${selectedClass.faculty}\n`;
      headerText += `Total Students: ${reportData.length}\n`;
      headerText +=
        "==================================================================\n";
    } else {
      // Generic / Summary Header
      headerText +=
        "==================================================================\n";
      headerText += `ATTENDANCE REPORT - ${
        yearFilter === "all" ? "All Years" : yearFilter + " Year"
      }\n`;
      headerText += `Department: ${
        branchFilter === "all" ? "All Branches" : branchFilter
      }\n`;
      headerText += `Total Students: ${reportData.length}\n`;
      headerText +=
        "==================================================================\n";
    }

    // 6. Handle Formats
    if (format === "csv" || format === "excel") {
      let csvContent = headerText + "\n"; // Add header at top
      csvContent +=
        "Roll No,Name,Department,Year,Semester,Classes Attended,Classes Held,Total Absent,Attendance %,Status\n";

      reportData.forEach((item) => {
        const s = item.student;
        const percentage =
          item.total > 0 ? Math.round((item.present / item.total) * 100) : 0;
        const status = percentage >= 75 ? "Eligible" : "Shortage";

        const row = [
          s.rollno,
          `"${s.firstname} ${s.lastname}"`,
          s.department,
          s.year,
          s.semester,
          item.present,
          item.total,
          item.absent,
          `${percentage}%`,
          status,
        ].join(",");
        csvContent += row + "\n";
      });

      const fileName = `Admin_Attendance_Report_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      downloadCSV(csvContent, fileName);
      showToast("Download started", "success");
    } else if (format === "json") {
      const jsonData = {
        meta: {
          class: selectedClass ? selectedClass.name : "All",
          faculty: selectedClass ? selectedClass.faculty : "N/A",
          generatedAt: new Date().toISOString(),
        },
        data: reportData.map((item) => ({
          rollNo: item.student.rollno,
          name: `${item.student.firstname} ${item.student.lastname}`,
          attendance: {
            present: item.present,
            total: item.total,
            percentage:
              item.total > 0
                ? Math.round((item.present / item.total) * 100)
                : 0,
          },
        })),
      };

      const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
        type: "application/json",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `attendance_data_${new Date().getTime()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("JSON Export successful", "success");
    } else if (format === "pdf") {
      const printWindow = window.open("", "_blank");

      // Convert \n to <br> for HTML display
      const htmlHeader = headerText.replace(/\n/g, "<br>");

      let htmlContent = `
        <html>
        <head>
          <title>Attendance Report</title>
          <style>
            body { font-family: sans-serif; font-size: 12px; }
            .header-box { background: #f8f9fa; padding: 15px; border: 1px solid #ddd; margin-bottom: 20px; font-family: monospace; font-size: 14px; white-space: pre-wrap; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <div class="header-box">${htmlHeader}</div>
          <table>
            <thead>
              <tr>
                <th>Roll No</th><th>Name</th><th>Dept</th><th>Sem</th>
                <th>Present</th><th>Total</th><th>%</th>
              </tr>
            </thead>
            <tbody>
      `;

      reportData.forEach((item) => {
        const s = item.student;
        const percentage =
          item.total > 0 ? Math.round((item.present / item.total) * 100) : 0;
        htmlContent += `
          <tr>
            <td>${s.rollno}</td>
            <td>${s.firstname} ${s.lastname}</td>
            <td>${s.department}</td>
            <td>${s.semester}</td>
            <td>${item.present}</td>
            <td>${item.total}</td>
            <td>${percentage}%</td>
          </tr>
        `;
      });

      htmlContent += `</tbody></table></body></html>`;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
      showToast("Opened Print Dialog", "success");
    }
  } catch (error) {
    console.error("Export Error:", error);
    showToast("Export failed. Check console.", "error");
  }
}
// =============================================
// TEMPLATE DOWNLOAD FUNCTIONS
// =============================================

// function downloadTemplate(type) {
//   if (typeof downloadCSV !== "function") {
//     showToast("Error: downloadCSV helper is missing", "error");
//     return;
//   }

//   let csvContent = "";
//   let filename = `${type}_template.csv`;

//   switch (type) {
//     case "students":
//       // Headers match database columns (lowercase)
//       csvContent = "rollno,firstname,lastname,email,department,year,semester";
//       break;

//     case "faculty":
//       // Headers match database columns (lowercase)
//       csvContent =
//         "facultyid,firstname,lastname,email,department,specialization,password";
//       break;

//     case "classes":
//       // Headers match database columns (lowercase)
//       csvContent = "code,name,department,semester,faculty,year,credits";
//       break;

//     default:
//       showToast("Unknown template type", "error");
//       return;
//   }

//   downloadCSV(csvContent, filename);
//   showToast(`Downloaded ${type} template`, "success");
// }

// =============================================
// BULK EXPORT FUNCTIONS
// =============================================

// async function exportBulkData(type) {
//   if (typeof downloadCSV !== "function") {
//     showToast("Error: downloadCSV helper is missing", "error");
//     return;
//   }

//   showToast(`Exporting ${type}...`, "info");

//   try {
//     const data = await getAll(type);
//     if (!data || data.length === 0) {
//       showToast(`No records found in ${type}`, "info");
//       return;
//     }

//     let csvContent = "";
//     let filename = `${type}_export_${new Date().getTime()}.csv`;

//     // Define headers and data mapping based on type
//     if (type === "students") {
//       csvContent =
//         "id,rollno,firstname,lastname,email,department,year,semester,createdat\n";
//       data.forEach((s) => {
//         // FIX: Using lowercase keys
//         const row = [
//           s.id,
//           s.rollno,
//           s.firstname,
//           s.lastname,
//           s.email || "",
//           s.department,
//           s.year,
//           s.semester,
//           s.createdat || "",
//         ]
//           .map((field) => `"${field}"`)
//           .join(","); // Quote fields to handle commas
//         csvContent += row + "\n";
//       });
//     } else if (type === "faculty") {
//       csvContent =
//         "id,facultyid,firstname,lastname,email,department,specialization,createdat\n";
//       data.forEach((f) => {
//         // FIX: Using lowercase keys
//         const row = [
//           f.id,
//           f.facultyid,
//           f.firstname,
//           f.lastname,
//           f.email || "",
//           f.department,
//           f.specialization || "",
//           f.createdat || "",
//         ]
//           .map((field) => `"${field}"`)
//           .join(",");
//         csvContent += row + "\n";
//       });
//     } else if (type === "classes") {
//       csvContent =
//         "id,code,name,department,semester,faculty,year,credits,createdat\n";
//       data.forEach((c) => {
//         // FIX: Using lowercase keys
//         const row = [
//           c.id,
//           c.code,
//           c.name,
//           c.department,
//           c.semester,
//           c.faculty,
//           c.year || "",
//           c.credits || "",
//           c.createdat || "",
//         ]
//           .map((field) => `"${field}"`)
//           .join(",");
//         csvContent += row + "\n";
//       });
//     }

//     downloadCSV(csvContent, filename);
//     showToast(
//       `Successfully exported ${data.length} records from ${type}`,
//       "success"
//     );
//   } catch (error) {
//     console.error(`Export error for ${type}:`, error);
//     showToast("Export failed. Check console.", "error");
//   }
// }

// =============================================
// COMPLETE DATABASE BACKUP FUNCTION
// =============================================

// async function exportCompleteDatabase() {
//   showToast("Preparing full database backup...", "info");

//   try {
//     // 1. Fetch data from all tables
//     const [students, faculty, classes, attendance, settings] =
//       await Promise.all([
//         getAll("students"),
//         getAll("faculty"),
//         getAll("classes"),
//         getAll("attendance"),
//         getAll("settings"), // Include settings if you have them
//       ]);

//     // 2. Create a single backup object
//     const backupData = {
//       meta: {
//         version: "2.0",
//         exportedAt: new Date().toISOString(),
//         description: "Full System Backup",
//       },
//       data: {
//         students: students || [],
//         faculty: faculty || [],
//         classes: classes || [],
//         attendance: attendance || [],
//         settings: settings || [],
//       },
//     };

//     // 3. Convert to JSON and Download
//     const jsonString = JSON.stringify(backupData, null, 2);
//     const blob = new Blob([jsonString], { type: "application/json" });
//     const link = document.createElement("a");

//     link.href = URL.createObjectURL(blob);
//     link.download = `FULL_BACKUP_${new Date()
//       .toISOString()
//       .slice(0, 10)
//       .replace(/-/g, "")}.json`;

//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);

//     showToast("Database backup downloaded successfully!", "success");
//   } catch (error) {
//     console.error("Backup error:", error);
//     showToast("Backup failed. Check console.", "error");
//   }
// }

// Initialize attendance module
document.addEventListener("DOMContentLoaded", function () {
  // Add multi-session button when page loads
  setTimeout(() => {
    addMultiSessionButton();
  }, 500);
});

// =============================================
// SECURE DELETE ATTENDANCE (ADMIN)
// =============================================

// 1. Inject the "Delete" button next to Export buttons
function injectAdminDeleteButton() {
  // Prevent duplicates
  if (document.getElementById("btnDeleteAdminAttendance")) return;

  // Find the Export Buttons container in Admin Panel
  // We look for the button group containing 'Export CSV'
  const exportGroup =
    document.querySelector("#adminPanel .btn-group") ||
    document.querySelector("#adminPanel .export-buttons") ||
    // Fallback: Find the 'Export JSON' button and grab its parent
    Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Export JSON"),
    )?.parentNode;

  if (!exportGroup) return;

  const deleteBtn = document.createElement("button");
  deleteBtn.id = "btnDeleteAdminAttendance";
  deleteBtn.className = "btn btn-danger"; // Red styling
  deleteBtn.innerHTML = "🗑️ Delete Records";
  deleteBtn.style.marginLeft = "10px";
  deleteBtn.onclick = deleteAdminAttendance;

  exportGroup.appendChild(deleteBtn);
}

// 2. Handle Secure Deletion
async function deleteAdminAttendance() {
  // --- STEP 1: GET FILTERS ---
  const classId = document.getElementById("adminClassFilter").value;
  const dateType =
    document.querySelector('input[name="dateFilterType"]:checked')?.value ||
    "all";
  const dateFrom = document.getElementById("adminDateFrom").value;
  const dateTo = document.getElementById("adminDateTo").value;

  // Safety: Require a specific class to be selected
  if (classId === "all") {
    showToast(
      "⚠️ Safety Lock: Please select a specific 'Class' to delete.",
      "warning",
    );
    return;
  }

  // --- STEP 2: FIND RECORDS ---
  showToast("Scanning records...", "info");
  const allAttendance = await getAll("attendance");

  // Filter by Class (Lowercase 'classid')
  let recordsToDelete = allAttendance.filter((r) => r.classid == classId);

  // Filter by Date Range (if active)
  if (dateType === "range" && dateFrom && dateTo) {
    recordsToDelete = recordsToDelete.filter(
      (r) => r.date >= dateFrom && r.date <= dateTo,
    );
  }

  if (recordsToDelete.length === 0) {
    showToast("No records found matching current filters.", "info");
    return;
  }

  // --- STEP 3: SECURITY PROMPT ---
  const confirmMsg = `⚠️ DANGER ZONE ⚠️\n\nYou are about to DELETE ${recordsToDelete.length} attendance records.\n\nFilters Applied:\n- Class ID: ${classId}\n- Date Mode: ${dateType}\n\nThis action CANNOT be undone.\n\nEnter ADMIN PASSWORD to confirm:`;

  const password = prompt(confirmMsg);

  if (password === null) return; // User cancelled

  // Verify Password (ADMIN_PASSWORD from config.js)
  if (password !== ADMIN_PASSWORD) {
    showToast("❌ Incorrect Password! Action Denied.", "error");
    return;
  }

  // --- STEP 4: EXECUTE DELETE ---
  if (!confirm("Are you absolutely sure?")) return;

  showToast(
    `Deleting ${recordsToDelete.length} records... Please wait.`,
    "info",
  );

  try {
    const deletePromises = recordsToDelete.map((r) =>
      deleteRecord("attendance", r.id),
    );
    await Promise.all(deletePromises);

    showToast(
      `✅ Successfully deleted ${recordsToDelete.length} records.`,
      "success",
    );

    // Refresh the table to show empty results
    loadAdminAttendanceHistory();
  } catch (error) {
    console.error("Delete failed:", error);
    showToast("Error deleting records. Check console.", "error");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // Existing initializers...
  setTimeout(() => {
    if (typeof addMultiSessionButton === "function") addMultiSessionButton();

    // ADD THIS LINE:
    injectAdminDeleteButton();
  }, 1000);
});

// =============================================
// BULK IMPORT HANDLERS (ADMIN)
// =============================================

// Handle Student Bulk Upload
// =============================================
// BULK IMPORT HANDLERS (WITH PROGRESS BAR)
// =============================================

// Handle Student Bulk Upload
async function handleStudentUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    const text = e.target.result;
    const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== "");

    // Skip header check
    const startIdx = lines[0].toLowerCase().includes("roll") ? 1 : 0;
    const totalLines = lines.length - startIdx;

    showProgressModal("Importing Students...");

    let success = 0;
    let errors = 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i]
        .split(",")
        .map((p) => p.trim().replace(/['"]+/g, ""));

      // Update Progress Bar
      updateProgress(
        i - startIdx + 1,
        totalLines,
        `Processing Roll No: ${parts[0] || "..."}`,
      );

      // Small delay to let UI render the progress bar
      await new Promise((r) => setTimeout(r, 10));

      if (parts.length < 3) {
        errors++;
        continue;
      }

      const record = {
        rollno: parts[0],
        firstname: parts[1],
        lastname: parts[2] || "",
        email: parts[3] || "",
        department: parts[4] || "General",
        year: parseInt(parts[5]) || 1,
        semester: parseInt(parts[6]) || 1,
        createdat: new Date().toISOString(),
      };

      const allStudents = await getAll("students");
      const exists = allStudents.find((s) => s.rollno == record.rollno);

      if (exists) {
        errors++;
      } else {
        await addRecord("students", record);
        success++;
      }
    }

    hideProgressModal();

    if (typeof showToast === "function") {
      showToast(
        `Imported ${success} students. ${errors} duplicates/errors.`,
        success > 0 ? "success" : "warning",
      );
    }
    event.target.value = "";
    if (typeof updateDashboard === "function") updateDashboard();
  };
  reader.readAsText(file);
}

// Handle Faculty Bulk Upload
async function handleFacultyUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    const text = e.target.result;
    const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== "");
    const startIdx = lines[0].toLowerCase().includes("facultyid") ? 1 : 0;
    const totalLines = lines.length - startIdx;

    showProgressModal("Importing Faculty...");

    let success = 0;
    let errors = 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i]
        .split(",")
        .map((p) => p.trim().replace(/['"]+/g, ""));

      updateProgress(
        i - startIdx + 1,
        totalLines,
        `Processing Faculty: ${parts[0] || "..."}`,
      );
      await new Promise((r) => setTimeout(r, 10));

      if (parts.length < 3) {
        errors++;
        continue;
      }

      const record = {
        facultyid: parts[0],
        firstname: parts[1],
        lastname: parts[2] || "",
        email: parts[3] || "",
        department: parts[4] || "General",
        specialization: parts[5] || "",
        password: parts[6] || "123456",
        createdat: new Date().toISOString(),
      };

      const allFaculty = await getAll("faculty");
      const exists = allFaculty.find((f) => f.facultyid == record.facultyid);

      if (exists) {
        errors++;
      } else {
        await addRecord("faculty", record);
        success++;
      }
    }

    hideProgressModal();

    if (typeof showToast === "function") {
      showToast(
        `Imported ${success} faculty members. ${errors} duplicates/errors.`,
        success > 0 ? "success" : "warning",
      );
    }
    event.target.value = "";
    if (typeof updateDashboard === "function") updateDashboard();
  };
  reader.readAsText(file);
}

// Handle Classes Bulk Upload
async function handleClassesUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    const text = e.target.result;
    const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== "");
    const startIdx = lines[0].toLowerCase().includes("code") ? 1 : 0;
    const totalLines = lines.length - startIdx;

    showProgressModal("Importing Classes...");

    let success = 0;
    let errors = 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i]
        .split(",")
        .map((p) => p.trim().replace(/['"]+/g, ""));

      updateProgress(
        i - startIdx + 1,
        totalLines,
        `Processing Subject: ${parts[0] || "..."}`,
      );
      await new Promise((r) => setTimeout(r, 10));

      if (parts.length < 4) {
        errors++;
        continue;
      }

      const record = {
        code: parts[0],
        name: parts[1],
        department: parts[2],
        semester: parseInt(parts[3]) || 1,
        faculty: parts[4] || "TBD",
        year: parseInt(parts[5]) || 1,
        credits: parseInt(parts[6]) || 3,
        createdat: new Date().toISOString(),
      };

      const allClasses = await getAll("classes");
      const exists = allClasses.find((c) => c.code == record.code);

      if (exists) {
        errors++;
      } else {
        await addRecord("classes", record);
        success++;
      }
    }

    hideProgressModal();

    if (typeof showToast === "function") {
      showToast(
        `Imported ${success} classes. ${errors} duplicates/errors.`,
        success > 0 ? "success" : "warning",
      );
    }
    event.target.value = "";
    if (typeof updateDashboard === "function") updateDashboard();
  };
  reader.readAsText(file);
}

// Handle Faculty Bulk Upload
async function handleFacultyUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (typeof showToast === "function")
    showToast("Processing Faculty file...", "info");

  const reader = new FileReader();
  reader.onload = async function (e) {
    const text = e.target.result;
    const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== "");
    const startIdx = lines[0].toLowerCase().includes("facultyid") ? 1 : 0;

    let success = 0;
    let errors = 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i]
        .split(",")
        .map((p) => p.trim().replace(/['"]+/g, ""));

      // CSV: facultyid, firstname, lastname, email, department, specialization, password
      if (parts.length < 3) {
        errors++;
        continue;
      }

      const record = {
        facultyid: parts[0],
        firstname: parts[1],
        lastname: parts[2] || "",
        email: parts[3] || "",
        department: parts[4] || "General",
        specialization: parts[5] || "",
        password: parts[6] || "123456", // Default password
        createdat: new Date().toISOString(),
      };

      const allFaculty = await getAll("faculty");
      const exists = allFaculty.find((f) => f.facultyid == record.facultyid);

      if (exists) {
        errors++;
      } else {
        await addRecord("faculty", record);
        success++;
      }
    }

    if (typeof showToast === "function") {
      showToast(
        `Imported ${success} faculty members. ${errors} duplicates/errors.`,
        success > 0 ? "success" : "warning",
      );
    }
    event.target.value = "";

    if (typeof updateDashboard === "function") updateDashboard();
  };
  reader.readAsText(file);
}

// Handle Classes Bulk Upload
async function handleClassesUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (typeof showToast === "function")
    showToast("Processing Classes file...", "info");

  const reader = new FileReader();
  reader.onload = async function (e) {
    const text = e.target.result;
    const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== "");
    const startIdx = lines[0].toLowerCase().includes("code") ? 1 : 0;

    let success = 0;
    let errors = 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i]
        .split(",")
        .map((p) => p.trim().replace(/['"]+/g, ""));

      // CSV: code, name, department, semester, faculty_name, year, credits
      if (parts.length < 4) {
        errors++;
        continue;
      }

      const record = {
        code: parts[0],
        name: parts[1],
        department: parts[2],
        semester: parseInt(parts[3]) || 1,
        faculty: parts[4] || "TBD",
        year: parseInt(parts[5]) || 1,
        credits: parseInt(parts[6]) || 3,
        createdat: new Date().toISOString(),
      };

      const allClasses = await getAll("classes");
      const exists = allClasses.find((c) => c.code == record.code);

      if (exists) {
        errors++;
      } else {
        await addRecord("classes", record);
        success++;
      }
    }

    if (typeof showToast === "function") {
      showToast(
        `Imported ${success} classes. ${errors} duplicates/errors.`,
        success > 0 ? "success" : "warning",
      );
    }
    event.target.value = "";

    if (typeof updateDashboard === "function") updateDashboard();
  };
  reader.readAsText(file);
}

// =============================================
// PROGRESS BAR UI HELPERS
// =============================================

function showProgressModal(title) {
  // Remove existing if any
  const existing = document.getElementById("progressModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "progressModal";
  modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
        z-index: 9999; backdrop-filter: blur(2px);
    `;

  modal.innerHTML = `
        <div style="background: white; padding: 25px; border-radius: 12px; width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #2c3e50;">${title}</h3>
            <div style="width: 100%; background: #ecf0f1; border-radius: 10px; height: 20px; overflow: hidden; margin-bottom: 10px;">
                <div id="progressBarFill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #3498db, #2ecc71); transition: width 0.3s ease;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: #7f8c8d;">
                <span id="progressText">Starting...</span>
                <span id="progressPercent">0%</span>
            </div>
        </div>
    `;

  document.body.appendChild(modal);
}

function updateProgress(current, total, text) {
  const percent = Math.round((current / total) * 100);
  const fill = document.getElementById("progressBarFill");
  const txt = document.getElementById("progressText");
  const pct = document.getElementById("progressPercent");

  if (fill) fill.style.width = `${percent}%`;
  if (txt) txt.textContent = text;
  if (pct) pct.textContent = `${percent}%`;
}

function hideProgressModal() {
  const modal = document.getElementById("progressModal");
  if (modal) modal.remove();
}
