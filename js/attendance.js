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
// Populate admin class filter
async function populateAdminClassFilter(
  semesterFilter = "all",
  branchFilter = "all"
) {
  const classes = await getAll("classes");
  const classSelect = document.getElementById("adminClassFilter");

  classSelect.innerHTML = '<option value="all">All Classes</option>';

  let filteredClasses = classes;

  if (semesterFilter !== "all") {
    filteredClasses = filteredClasses.filter(
      (cls) => cls.semester == semesterFilter
    );
  }

  if (branchFilter !== "all") {
    filteredClasses = filteredClasses.filter(
      (cls) => cls.department === branchFilter
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
      (cls) => cls.semester == semesterFilter
    );
  }

  if (branchFilter !== "all") {
    filteredClasses = filteredClasses.filter(
      (cls) => cls.department === branchFilter
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
  document.getElementById(
    "studentNameDisplay"
  ).textContent = `${student.firstname} ${student.lastname}`;

  document.getElementById(
    "studentRollDisplay"
  ).textContent = `Roll No: ${student.rollno}`;

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
    "faculty" + tab.charAt(0).toUpperCase() + tab.slice(1)
  );
  if (selectedTab) {
    selectedTab.style.display = "block";
  }

  // Load data for specific tabs
  if (tab === "history") {
    loadAttendanceHistory();
  } else if (tab === "report") {
    generateYearlyReport();
  }
}

// Load attendance history
// Load attendance history (Fixed for Lowercase DB Columns)
async function loadAttendanceHistory() {
  const classId = parseInt(document.getElementById("historyClassSelect").value);
  const dateFilter = document.getElementById("historyDateFilter").value;
  const container = document.getElementById("historyList");

  if (!classId) {
    container.innerHTML =
      '<p style="text-align:center; color:gray;">Please select a class first.</p>';
    return;
  }

  const allAttendance = await getAll("attendance");
  const allStudents = await getAll("students");
  const allClasses = await getAll("classes");

  const classInfo = allClasses.find((c) => c.id === classId);
  if (!classInfo) return;

  // FIX: Using lowercase 'classid'
  let classRecords = allAttendance.filter((r) => r.classid === classId);

  if (dateFilter) {
    classRecords = classRecords.filter((r) => r.date === dateFilter);
  }

  // Group by date first, then by session
  const dateGroups = {};
  classRecords.forEach((r) => {
    if (!dateGroups[r.date]) {
      dateGroups[r.date] = [];
    }
    dateGroups[r.date].push(r);
  });

  container.innerHTML = "";

  if (Object.keys(dateGroups).length === 0) {
    container.innerHTML =
      '<p style="text-align:center; color:gray;">No attendance records found.</p>';
    return;
  }

  // Sort dates in descending order (most recent first)
  const sortedDates = Object.keys(dateGroups).sort(
    (a, b) => new Date(b) - new Date(a)
  );

  // Process each date
  sortedDates.forEach((date) => {
    const recordsForDate = dateGroups[date];

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

    // Create date header
    const dateHeader = document.createElement("div");
    dateHeader.className = "date-header"; // Uses the CSS class we added earlier

    // Fallback styling in case CSS class isn't picked up immediately
    if (!dateHeader.classList.contains("date-header")) {
      dateHeader.style.background = "linear-gradient(135deg, #3498db, #2980b9)";
      dateHeader.style.color = "white";
      dateHeader.style.padding = "12px 20px";
      dateHeader.style.borderRadius = "8px 8px 0 0";
      dateHeader.style.marginTop = "20px";
    }

    const formattedDate = new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    dateHeader.innerHTML = `
            <div>
                <span style="font-size: 16px;">📅 ${formattedDate}</span>
                <span style="font-size: 12px; opacity: 0.9; margin-left: 10px;">(${
                  sortedSessions.length
                } session${sortedSessions.length > 1 ? "s" : ""})</span>
            </div>
            <div style="font-size: 12px; opacity: 0.9;">Total: ${
              recordsForDate.length
            }</div>
        `;
    container.appendChild(dateHeader);

    // Process each session
    sortedSessions.forEach((sessionNum) => {
      const recordsForSession = sessionGroups[sessionNum];
      const present = recordsForSession.filter(
        (r) => r.status === "present"
      ).length;
      const absent = recordsForSession.filter(
        (r) => r.status === "absent"
      ).length;

      const sessionHeader = document.createElement("div");
      sessionHeader.style.background = "rgba(52, 152, 219, 0.1)";
      sessionHeader.style.padding = "15px";
      sessionHeader.style.borderBottom = "1px solid rgba(52, 152, 219, 0.2)";
      sessionHeader.style.color = "#2c5282";

      sessionHeader.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size: 14px; font-weight: 600;">📋 Session ${sessionNum}</span>
                        <span class="session-indicator">${classInfo.code}</span>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <span style="padding: 4px 8px; background: #d4edda; color: #155724; border-radius: 4px; font-size: 12px; font-weight:600;">✅ ${present}</span>
                        <span style="padding: 4px 8px; background: #f8d7da; color: #721c24; border-radius: 4px; font-size: 12px; font-weight:600;">❌ ${absent}</span>
                    </div>
                </div>
            `;
      container.appendChild(sessionHeader);

      const sessionContent = document.createElement("div");
      sessionContent.style.background = "white";
      sessionContent.style.padding = "15px";
      sessionContent.style.borderBottom = "2px solid #f0f0f0";

      sessionContent.innerHTML = `
                <table style="width:100%; font-size:13px; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa; border-bottom: 2px solid #e9ecef;">
                            <th style="padding: 10px; text-align:left;">Name</th>
                            <th style="padding: 10px; text-align:left;">Roll No</th>
                            <th style="padding: 10px; text-align:left;">Status</th>
                            <th style="padding: 10px; text-align:left;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="records-${date.replace(
                      /-/g,
                      ""
                    )}-${sessionNum}"></tbody>
                </table>
            `;
      container.appendChild(sessionContent);

      const tbody = document.getElementById(
        `records-${date.replace(/-/g, "")}-${sessionNum}`
      );

      // FIX: Using lowercase 'studentid' for sorting
      recordsForSession.sort((a, b) => {
        const studentA = allStudents.find((s) => s.id === a.studentid) || {};
        const studentB = allStudents.find((s) => s.id === b.studentid) || {};
        // FIX: Using lowercase 'rollno'
        return (studentA.rollno || "").localeCompare(studentB.rollno || "");
      });

      recordsForSession.forEach((record) => {
        // FIX: Using lowercase 'studentid'
        const student =
          allStudents.find((s) => s.id === record.studentid) || {};

        const statusColors = {
          present: { bg: "#d4edda", color: "#155724", icon: "✅" },
          absent: { bg: "#f8d7da", color: "#721c24", icon: "❌" },
        };
        const status = statusColors[record.status] || statusColors.absent;

        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #f0f0f0";

        // FIX: Using lowercase 'firstname', 'lastname', 'rollno'
        tr.innerHTML = `
            <td style="padding: 10px;">${student.firstname || "Unknown"} ${
          student.lastname || ""
        }</td>
            <td style="padding: 10px; font-weight:500;">${
              student.rollno || "N/A"
            }</td>
            <td style="padding: 10px;">
                <span style="padding: 6px 12px; background: ${
                  status.bg
                }; color: ${
          status.color
        }; border-radius: 20px; font-size: 12px; font-weight:600;">
                    ${status.icon} ${
          record.status.charAt(0).toUpperCase() + record.status.slice(1)
        }
                </span>
            </td>
            <td style="padding: 10px;">
                <button class="btn btn-small btn-info" onclick="openEditAttendanceModal(${
                  record.id
                })">✏️ Edit</button>
            </td>
        `;
        tbody.appendChild(tr);
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
    (r) => r.classId === classId && r.date === date
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
    `attendance_${classInfo.code}_${date.replace(/-/g, "")}.csv`
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
    (a, b) => new Date(b) - new Date(a)
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
      }
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
        (r) => r.status === "present"
      ).length;
      const absent = recordsForSession.filter(
        (r) => r.status === "absent"
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
    (r) => r.status === "present"
  ).length;
  const overallAbsent = classRecords.filter(
    (r) => r.status === "absent"
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
async function generateYearlyReport() {
  const tbody = document.getElementById("yearWiseAttendanceBody");
  tbody.innerHTML =
    '<tr><td colspan="5" style="text-align:center;">Loading stats...</td></tr>';

  const attendance = await getAll("attendance");
  const students = await getAll("students");
  const classes = await getAll("classes"); // Need to know class year

  // Map classId -> Year
  const classYearMap = new Map();
  classes.forEach((c) => classYearMap.set(c.id, c.year));

  // Initialize Stats per Year (1,2,3,4)
  const stats = {
    1: { held: 0, present: 0, absent: 0 },
    2: { held: 0, present: 0, absent: 0 },
    3: { held: 0, present: 0, absent: 0 },
    4: { held: 0, present: 0, absent: 0 },
  };

  // Aggregate
  attendance.forEach((r) => {
    // Try to get year from class, if fails try student year
    let year = classYearMap.get(r.classId);
    if (!year) {
      const s = students.find((st) => st.id === r.studentId);
      if (s) year = Math.ceil(s.semester / 2); // Approx year from sem
    }

    if (year && stats[year]) {
      stats[year].held++; // Counting total records as "held opportunities"
      if (r.status === "present") stats[year].present++;
      else if (r.status === "absent") stats[year].absent++;
    }
  });

  tbody.innerHTML = "";

  for (let year = 1; year <= 4; year++) {
    const s = stats[year];
    const total = s.present + s.absent;
    const percent = total > 0 ? Math.round((s.present / total) * 100) : 0;

    const row = document.createElement("tr");
    row.innerHTML = `
                    <td>${year}</td>
                    <td>${total}</td>
                    <td>${s.present}</td>
                    <td>${s.absent}</td>
                    <td><strong>${percent}%</strong></td>
                 `;
    tbody.appendChild(row);
  }
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
    `input[name="attendanceStatus"][value="${record.status}"]`
  ).checked = true;

  openModal("editAttendanceModal");
}

// Save edited attendance
async function saveEditedAttendance(event) {
  event.preventDefault();

  const attendanceId = parseInt(
    document.getElementById("editAttendanceId").value
  );
  const record = await getRecord("attendance", attendanceId);

  if (!record) {
    showToast("Record not found!", "error");
    return;
  }

  const newStatus = document.querySelector(
    'input[name="attendanceStatus"]:checked'
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
    document.getElementById("editAttendanceId").value
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
    (a, b) => new Date(b) - new Date(a)
  );

  // Create CLEAN CSV - SAME FORMAT AS ATTENDANCE HISTORY
  let csvLines = [];
  csvLines.push(
    "=================================================================="
  );
  csvLines.push(`ATTENDANCE REPORT - ${classInfo.code}: ${classInfo.name}`);
  csvLines.push(
    `Department: ${classInfo.department}, Semester: ${classInfo.semester}`
  );
  csvLines.push(`Faculty: ${classInfo.faculty}`);
  if (date) {
    csvLines.push(`Filtered Date: ${date}`);
  }
  csvLines.push(`Total Records: ${classRecords.length}`);
  csvLines.push(
    "=================================================================="
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
    }`
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
        "-------------------------------------------------------------------------------------------------------------"
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
      })`
    );
    csvLines.push(
      "======================================================================"
    );

    sortedSessions.forEach((sessionNum, sessionIndex) => {
      const sessionRecords = sessionGroups[sessionNum];

      // ADD X SEPARATOR FOR SESSION
      csvLines.push(
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
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
        (r) => r.status === "present"
      ).length;
      const absent = sessionRecords.filter((r) => r.status === "absent").length;
      const percentage =
        sessionRecords.length > 0
          ? Math.round((present / sessionRecords.length) * 100)
          : 0;
      csvLines.push(
        `   -- Session ${sessionNum} Summary: ${present} Present | ${absent} Absent | ${percentage}% --`
      );
      csvLines.push("");
    });

    // Date summary
    const datePresent = recordsForDate.filter(
      (r) => r.status === "present"
    ).length;
    const dateAbsent = recordsForDate.filter(
      (r) => r.status === "absent"
    ).length;
    const datePercentage =
      recordsForDate.length > 0
        ? Math.round((datePresent / recordsForDate.length) * 100)
        : 0;
    csvLines.push(
      `   Date Summary: ${datePresent} Present | ${dateAbsent} Absent | ${datePercentage}% Attendance`
    );
    csvLines.push(
      "======================================================================"
    );
  });

  csvLines.push("");
  csvLines.push(
    "=================================================================="
  );
  csvLines.push("OVERALL SUMMARY");
  csvLines.push(
    "=================================================================="
  );
  csvLines.push(`Total Dates: ${sortedDates.length}`);
  csvLines.push(
    `Total Sessions: ${Object.values(dateGroups).reduce((sum, records) => {
      const sessions = new Set(records.map((r) => r.session || 1));
      return sum + sessions.size;
    }, 0)}`
  );
  csvLines.push(`Total Records: ${classRecords.length}`);
  csvLines.push(`Total Present: ${totalPresent}`);
  csvLines.push(`Total Absent: ${totalAbsent}`);
  csvLines.push(
    `Overall Attendance: ${
      classRecords.length > 0
        ? Math.round((totalPresent / classRecords.length) * 100)
        : 0
    }%`
  );
  csvLines.push(`Export Date: ${new Date().toLocaleString()}`);

  const csvContent = csvLines.join("\n");
  downloadCSV(
    csvContent,
    `attendance_report_${classInfo.code}_${
      date ? date.replace(/-/g, "") : "all"
    }_${new Date().getTime()}.csv`
  );
  showToast(`Exported ${classRecords.length} attendance records`, "success");
}

// =============================================
// ATTENDANCE MARKING FUNCTIONS
// =============================================

// Add multi-session button
// Add multi-session button (Fixed: Prevents duplicates)
function addMultiSessionButton() {
  // 1. Check if button already exists
  if (document.getElementById("multiSessionBtn")) {
    return; // Stop if button is already there
  }

  const submitButton = document.querySelector("#facultyMark .btn-success");
  if (!submitButton) return;

  const multiSessionBtn = document.createElement("button");
  multiSessionBtn.type = "button";
  multiSessionBtn.className = "btn btn-warning";
  multiSessionBtn.id = "multiSessionBtn";
  multiSessionBtn.textContent = "📅 Mark Multiple Sessions";
  multiSessionBtn.onclick = markMultipleSessions;
  multiSessionBtn.style.display = "inline-block";
  multiSessionBtn.style.marginLeft = "10px";

  submitButton.parentNode.insertBefore(
    multiSessionBtn,
    submitButton.nextSibling
  );
}

// Mark multiple sessions
// Mark multiple sessions (Fixed: Detects existing records)
async function markMultipleSessions() {
  const classId = parseInt(document.getElementById("facultyClassSelect").value);
  const date = document.getElementById("attendanceDate").value;
  const endSession = parseInt(
    document.getElementById("attendanceSession").value
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
            r.classid === classId && r.date === date && r.session === session
        );

        // FIX: Map using lowercase 'studentid'
        const existingMap = new Map(
          existingForSession.map((r) => [r.studentid, r])
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
        `Attendance saved for ${totalRecords} records across ${endSession} sessions!`
      );
      if (typeof generateYearlyReport === "function") generateYearlyReport();
    }
  );
}

// Load class students
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

  const classes = await getAll("classes");
  const selectedClass = classes.find((c) => c.id === classId);
  if (!selectedClass) return;

  const allStudents = await getAll("students");
  const classStudents = allStudents.filter(
    (s) =>
      s.semester === selectedClass.semester &&
      s.department === selectedClass.department
  );

  const allAttendance = await getAll("attendance");
  const existingAttendance = allAttendance.filter(
    (r) => r.classId === classId && r.date === date && r.session === session
  );

  const attendanceMap = new Map(
    existingAttendance.map((r) => [r.studentId, r.status])
  );

  const grid = document.getElementById("studentGrid");
  grid.innerHTML = "";

  if (classStudents.length === 0) {
    grid.innerHTML =
      '<p style="text-align:center; width:100%;">No students found for this class criteria.</p>';
  }

  classStudents.forEach((student) => {
    const status = attendanceMap.get(student.id) || "absent";
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
    (r) => r.classid === classId && r.date === date && r.session === session
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
      `Attendance saved for ${checkboxes.length} students in Session ${session}!`
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
async function saveBulkAttendance() {
  const classId = parseInt(document.getElementById("facultyClassSelect").value);
  if (!classId) return;

  const date = document.getElementById("attendanceDate").value;
  if (!date) {
    showToast("Please select a date first", "error");
    return;
  }

  const session = parseInt(
    document.getElementById("bulkAttendanceSession").value
  );
  if (!session) {
    showToast("Please select a session", "error");
    return;
  }

  const input = document.getElementById("bulkAttendanceInput").value;
  const lines = input.split(/\r\n|\n|\r/);

  const allStudents = await getAll("students");
  const allAttendance = await getAll("attendance");

  let successCount = 0;

  for (let line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(",").map((s) => s.trim());
    const rollNo = parts[0];
    const statusKey = parts.length > 1 ? parts[1].toUpperCase() : "P";

    // Validate status - only P or A allowed
    let status = "present";
    if (statusKey === "A") status = "absent";

    // FIX 1: Using lowercase 'rollno' to find the student
    const student = allStudents.find((s) => s.rollno == rollNo);

    if (student) {
      // FIX 2: Using lowercase keys for checking existing records
      const existingRecord = allAttendance.find(
        (r) =>
          r.classid === classId &&
          r.studentid === student.id &&
          r.date === date &&
          r.session === session
      );

      // FIX 3: Creating record with lowercase keys for Supabase
      const record = {
        classid: classId,
        studentid: student.id,
        date: date,
        session: session,
        status: status,
        notes: `Session ${session}`,
        createdat: new Date().toISOString(),
      };

      if (existingRecord) {
        record.id = existingRecord.id;
        await updateRecord("attendance", record);
      } else {
        await addRecord("attendance", record);
      }

      successCount++;

      // Update UI if student card exists and same session
      const currentSession = parseInt(
        document.getElementById("attendanceSession").value
      );
      if (session === currentSession) {
        const card = document.getElementById(`student-card-${student.id}`);
        if (card) {
          const checkbox = card.querySelector(".attendance-checkbox");
          if (checkbox) {
            checkbox.checked = status === "present";
          }
        }
      }
    }
  }

  showToast(
    `Processed ${successCount} attendance records for Session ${session}`,
    "success"
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
    (s) => s.department === branch && s.semester === sem
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
      "success"
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
async function viewStudentAttendance(studentId) {
  const allStudents = await getAll("students");
  const student = allStudents.find((s) => s.id === studentId);

  if (!student) {
    showToast("Student not found", "error");
    return;
  }

  const fullName = `${student.firstname} ${student.lastname}`;
  const rollNo = student.rollno;

  const allAttendance = await getAll("attendance");
  const allClasses = await getAll("classes");

  // FIX: Using lowercase 'studentid'
  const studentAttendance = allAttendance.filter(
    (r) => r.studentid === studentId
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
                <div>
                    <div style='font-size: 14px; font-weight: bold; color: #2c3e50;'>
                        ${cls ? cls.code : "N/A"}
                    </div>
                    <div style='font-size: 12px; color: #7f8c8d;'>
                        ${cls ? cls.name : "Unknown Class"}
                    </div>
                </div>
                <div style='text-align: right; font-size: 13px;'>
                    <span style='margin: 0 10px; color: #7f8c8d;'>
                        <strong>${stats.total}</strong> Classes
                    </span>
                    <span style='font-weight: bold; color: ${statusColor}; font-size: 16px; margin-left: 10px;'>
                        ${percentage}%
                    </span>
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
  studentName
) {
  const [attendance, classes] = await Promise.all([
    getAll("attendance"),
    getAll("classes"),
  ]);

  const currentClass = classes.find((c) => c.id === classId);
  const studentAttendance = attendance.filter(
    (r) => r.studentId === studentId && r.classId === classId
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
    (r) => r.status === "present"
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
    `attendance_${rollNo}_${currentClass.code}_${new Date().getTime()}.csv`
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
    "Roll No,Student Name,Total Classes,Attended,Absent,Attendance %,Status"
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
      `${student.rollno},${student.firstname} ${student.lastname},${stats.total},${stats.present},${stats.absent},${percentage}%,${status}`
    );
  });

  // Add summary
  csvLines.push("");
  csvLines.push("SUMMARY STATISTICS");
  csvLines.push(`Total Students,${totalStudents}`);
  csvLines.push(
    `Total Classes Held,${classRecords.length / totalStudents || 0}`
  );
  csvLines.push(`Total Attendance Records,${classRecords.length}`);
  csvLines.push(`Total Present,${totalPresent}`);
  csvLines.push(`Total Absent,${totalAbsent}`);
  csvLines.push(
    `Overall Attendance %,${
      classRecords.length > 0
        ? Math.round((totalPresent / classRecords.length) * 100)
        : 0
    }%`
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
    'input[name="dateFilterType"]:checked'
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
      (r) => r.status === statusFilter
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
          b.student.firstname || ""
        );
      case "name_desc":
        return (b.student.firstname || "").localeCompare(
          a.student.firstname || ""
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
    'input[name="dateFilterType"][value="all"]'
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
    'input[name="dateFilterType"]:checked'
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
          (r) => r.date >= dateFrom
        );
      if (dateTo)
        filteredAttendance = filteredAttendance.filter((r) => r.date <= dateTo);
    }

    if (statusFilter !== "all") {
      filteredAttendance = filteredAttendance.filter(
        (r) => r.status === statusFilter
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

function downloadTemplate(type) {
  if (typeof downloadCSV !== "function") {
    showToast("Error: downloadCSV helper is missing", "error");
    return;
  }

  let csvContent = "";
  let filename = `${type}_template.csv`;

  switch (type) {
    case "students":
      // Headers match database columns (lowercase)
      csvContent = "rollno,firstname,lastname,email,department,year,semester";
      break;

    case "faculty":
      // Headers match database columns (lowercase)
      csvContent =
        "facultyid,firstname,lastname,email,department,specialization,password";
      break;

    case "classes":
      // Headers match database columns (lowercase)
      csvContent = "code,name,department,semester,faculty,year,credits";
      break;

    default:
      showToast("Unknown template type", "error");
      return;
  }

  downloadCSV(csvContent, filename);
  showToast(`Downloaded ${type} template`, "success");
}

// =============================================
// BULK EXPORT FUNCTIONS
// =============================================

async function exportBulkData(type) {
  if (typeof downloadCSV !== "function") {
    showToast("Error: downloadCSV helper is missing", "error");
    return;
  }

  showToast(`Exporting ${type}...`, "info");

  try {
    const data = await getAll(type);
    if (!data || data.length === 0) {
      showToast(`No records found in ${type}`, "info");
      return;
    }

    let csvContent = "";
    let filename = `${type}_export_${new Date().getTime()}.csv`;

    // Define headers and data mapping based on type
    if (type === "students") {
      csvContent =
        "id,rollno,firstname,lastname,email,department,year,semester,createdat\n";
      data.forEach((s) => {
        // FIX: Using lowercase keys
        const row = [
          s.id,
          s.rollno,
          s.firstname,
          s.lastname,
          s.email || "",
          s.department,
          s.year,
          s.semester,
          s.createdat || "",
        ]
          .map((field) => `"${field}"`)
          .join(","); // Quote fields to handle commas
        csvContent += row + "\n";
      });
    } else if (type === "faculty") {
      csvContent =
        "id,facultyid,firstname,lastname,email,department,specialization,createdat\n";
      data.forEach((f) => {
        // FIX: Using lowercase keys
        const row = [
          f.id,
          f.facultyid,
          f.firstname,
          f.lastname,
          f.email || "",
          f.department,
          f.specialization || "",
          f.createdat || "",
        ]
          .map((field) => `"${field}"`)
          .join(",");
        csvContent += row + "\n";
      });
    } else if (type === "classes") {
      csvContent =
        "id,code,name,department,semester,faculty,year,credits,createdat\n";
      data.forEach((c) => {
        // FIX: Using lowercase keys
        const row = [
          c.id,
          c.code,
          c.name,
          c.department,
          c.semester,
          c.faculty,
          c.year || "",
          c.credits || "",
          c.createdat || "",
        ]
          .map((field) => `"${field}"`)
          .join(",");
        csvContent += row + "\n";
      });
    }

    downloadCSV(csvContent, filename);
    showToast(
      `Successfully exported ${data.length} records from ${type}`,
      "success"
    );
  } catch (error) {
    console.error(`Export error for ${type}:`, error);
    showToast("Export failed. Check console.", "error");
  }
}

// =============================================
// COMPLETE DATABASE BACKUP FUNCTION
// =============================================

async function exportCompleteDatabase() {
  showToast("Preparing full database backup...", "info");

  try {
    // 1. Fetch data from all tables
    const [students, faculty, classes, attendance, settings] =
      await Promise.all([
        getAll("students"),
        getAll("faculty"),
        getAll("classes"),
        getAll("attendance"),
        getAll("settings"), // Include settings if you have them
      ]);

    // 2. Create a single backup object
    const backupData = {
      meta: {
        version: "2.0",
        exportedAt: new Date().toISOString(),
        description: "Full System Backup",
      },
      data: {
        students: students || [],
        faculty: faculty || [],
        classes: classes || [],
        attendance: attendance || [],
        settings: settings || [],
      },
    };

    // 3. Convert to JSON and Download
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = `FULL_BACKUP_${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Database backup downloaded successfully!", "success");
  } catch (error) {
    console.error("Backup error:", error);
    showToast("Backup failed. Check console.", "error");
  }
}
