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

  let classRecords = allAttendance.filter((r) => r.classId === classId);

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

    // Create date header with session count
    const dateHeader = document.createElement("div");
    dateHeader.style.background = "linear-gradient(135deg, #3498db, #2980b9)";
    dateHeader.style.color = "white";
    dateHeader.style.padding = "12px 20px";
    dateHeader.style.borderRadius = "8px 8px 0 0";
    dateHeader.style.marginTop = "20px";
    dateHeader.style.fontWeight = "600";
    dateHeader.style.display = "flex";
    dateHeader.style.justifyContent = "space-between";
    dateHeader.style.alignItems = "center";

    // Format date nicely
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
            <div style="font-size: 12px; opacity: 0.9;">
                Total Records: ${recordsForDate.length}
            </div>
        `;
    container.appendChild(dateHeader);

    // Process each session for this date
    sortedSessions.forEach((sessionNum) => {
      const recordsForSession = sessionGroups[sessionNum];
      const total = recordsForSession.length;
      const present = recordsForSession.filter(
        (r) => r.status === "present"
      ).length;
      const absent = recordsForSession.filter(
        (r) => r.status === "absent"
      ).length;

      // Create session header
      const sessionHeader = document.createElement("div");
      sessionHeader.style.background = "rgba(52, 152, 219, 0.1)";
      sessionHeader.style.padding = "15px";
      sessionHeader.style.borderBottom = "1px solid rgba(52, 152, 219, 0.2)";
      sessionHeader.style.fontWeight = "600";
      sessionHeader.style.color = "#2c5282";

      sessionHeader.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size: 14px;">📋 Session ${sessionNum}</span>
                        <span class="session-indicator">${classInfo.code}: ${classInfo.name}</span>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <span style="padding: 4px 8px; background: #d4edda; color: #155724; border-radius: 4px; font-size: 12px; font-weight:600;">
                            ✅ ${present} Present
                        </span>
                        <span style="padding: 4px 8px; background: #f8d7da; color: #721c24; border-radius: 4px; font-size: 12px; font-weight:600;">
                            ❌ ${absent} Absent
                        </span>
                    </div>
                </div>
            `;
      container.appendChild(sessionHeader);

      // Create session content container
      const sessionContent = document.createElement("div");
      sessionContent.style.background = "white";
      sessionContent.style.padding = "15px";
      sessionContent.style.borderBottom = "2px solid #f0f0f0";

      // Create table for this session
      sessionContent.innerHTML = `
                <table style="width:100%; font-size:13px; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa; border-bottom: 2px solid #e9ecef;">
                            <th style="padding: 10px; text-align:left; font-weight:600;">Student Name</th>
                            <th style="padding: 10px; text-align:left; font-weight:600;">Roll No</th>
                            <th style="padding: 10px; text-align:left; font-weight:600;">Status</th>
                            <th style="padding: 10px; text-align:left; font-weight:600;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="records-${date.replace(/-/g, "")}-${sessionNum}">
                        <!-- Records will be populated here -->
                    </tbody>
                </table>
            `;
      container.appendChild(sessionContent);

      // Populate individual records for this session
      const tbody = document.getElementById(
        `records-${date.replace(/-/g, "")}-${sessionNum}`
      );
      recordsForSession.sort((a, b) => {
        const studentA = allStudents.find((s) => s.id === a.studentId) || {};
        const studentB = allStudents.find((s) => s.id === b.studentId) || {};
        return (studentA.rollNo || "").localeCompare(studentB.rollNo || "");
      });

      recordsForSession.forEach((record) => {
        const student =
          allStudents.find((s) => s.id === record.studentId) || {};
        const statusColors = {
          present: { bg: "#d4edda", color: "#155724", icon: "✅" },
          absent: { bg: "#f8d7da", color: "#721c24", icon: "❌" },
        };
        const status = statusColors[record.status] || statusColors.absent;

        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #f0f0f0";
        tr.style.transition = "background 0.2s";
        tr.onmouseenter = () => (tr.style.background = "#f8f9fa");
        tr.onmouseleave = () => (tr.style.background = "");

        tr.innerHTML = `
                    <td style="padding: 10px;">${student.firstName || ""} ${
          student.lastName || ""
        }</td>
                    <td style="padding: 10px; font-weight:500;">${
                      student.rollNo || "N/A"
                    }</td>
                    <td style="padding: 10px;">
                        <span style="padding: 6px 12px; background: ${
                          status.bg
                        }; color: ${
          status.color
        }; border-radius: 20px; font-size: 12px; font-weight:600; display:inline-block; min-width: 70px; text-align:center;">
                            ${status.icon} ${
          record.status.charAt(0).toUpperCase() + record.status.slice(1)
        }
                        </span>
                    </td>
                    <td style="padding: 10px;">
                        <button class="btn btn-small btn-info" onclick="openEditAttendanceModal(${
                          record.id
                        })" style="padding: 4px 12px; font-size: 12px;">
                            ✏️ Edit
                        </button>
                    </td>
                `;
        tbody.appendChild(tr);
      });

      // Add separator between sessions (except after last session)
      if (sessionNum < sortedSessions[sortedSessions.length - 1]) {
        const separator = document.createElement("div");
        separator.style.height = "2px";
        separator.style.background =
          "linear-gradient(90deg, transparent, #e0e0e0, transparent)";
        separator.style.margin = "15px 0";
        container.appendChild(separator);
      }
    });

    // Add date footer with summary
    const dateFooter = document.createElement("div");
    dateFooter.style.background = "#f8f9fa";
    dateFooter.style.padding = "10px 20px";
    dateFooter.style.borderRadius = "0 0 8px 8px";
    dateFooter.style.borderTop = "1px solid #e9ecef";
    dateFooter.style.fontSize = "12px";
    dateFooter.style.color = "#666";
    dateFooter.style.display = "flex";
    dateFooter.style.justifyContent = "space-between";

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

    dateFooter.innerHTML = `
            <div>
                <strong>Date Summary:</strong> 
                <span style="color: #27ae60; margin-left: 5px;">${datePresent} Present</span> | 
                <span style="color: #e74c3c; margin: 0 5px;">${dateAbsent} Absent</span> | 
                <span style="color: #3498db; margin-left: 5px;">${datePercentage}% Attendance</span>
            </div>
            <div>
                <button class="btn btn-small btn-secondary" onclick="exportDateAttendance('${date}', ${classId})" style="padding: 3px 10px; font-size: 11px;">
                    📥 Export This Date
                </button>
            </div>
        `;
    container.appendChild(dateFooter);

    // Add visual separator between dates
    if (date !== sortedDates[sortedDates.length - 1]) {
      const dateSeparator = document.createElement("div");
      dateSeparator.style.height = "20px";
      dateSeparator.style.background =
        "repeating-linear-gradient(45deg, transparent, transparent 5px, #f0f0f0 5px, #f0f0f0 10px)";
      dateSeparator.style.margin = "20px 0";
      container.appendChild(dateSeparator);
    }
  });

  // Add summary at the end
  if (sortedDates.length > 1) {
    const overallSummary = document.createElement("div");
    overallSummary.style.background =
      "linear-gradient(135deg, #2c3e50, #34495e)";
    overallSummary.style.color = "white";
    overallSummary.style.padding = "15px 20px";
    overallSummary.style.borderRadius = "8px";
    overallSummary.style.marginTop = "30px";
    overallSummary.style.textAlign = "center";

    let allRecords = [];
    sortedDates.forEach((date) => {
      allRecords = allRecords.concat(dateGroups[date]);
    });

    const totalRecords = allRecords.length;
    const totalPresent = allRecords.filter(
      (r) => r.status === "present"
    ).length;
    const totalAbsent = allRecords.filter((r) => r.status === "absent").length;
    const overallPercentage =
      totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

    overallSummary.innerHTML = `
            <h4 style="margin-bottom: 10px; opacity: 0.9;">📊 Overall Summary</h4>
            <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;">
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: bold;">${sortedDates.length}</div>
                    <div style="font-size: 12px; opacity: 0.8;">Dates</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #27ae60;">${totalPresent}</div>
                    <div style="font-size: 12px; opacity: 0.8;">Total Present</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #e74c3c;">${totalAbsent}</div>
                    <div style="font-size: 12px; opacity: 0.8;">Total Absent</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #3498db;">${overallPercentage}%</div>
                    <div style="font-size: 12px; opacity: 0.8;">Overall Attendance</div>
                </div>
            </div>
        `;
    container.appendChild(overallSummary);
  }
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

  let classRecords = allAttendance.filter((r) => r.classId === classId);

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

  // Use ASCII-only separators
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

    // Date header in CSV - use ASCII only
    csvContent += `Date: ${formattedDate} (${sortedSessions.length} session${
      sortedSessions.length > 1 ? "s" : ""
    })\n`;
    csvContent += "=".repeat(70) + "\n";

    // Process each session for this date
    sortedSessions.forEach((sessionNum, sessionIndex) => {
      const recordsForSession = sessionGroups[sessionNum];

      // Session header - use ASCII only
      csvContent += `   Session ${sessionNum}\n`;
      csvContent += "   " + "-".repeat(60) + "\n";

      // Session table headers
      csvContent += "   Roll No,Student Name,Status,Time Recorded\n";

      // Sort records by roll number
      recordsForSession.sort((a, b) => {
        const studentA = allStudents.find((s) => s.id === a.studentId) || {};
        const studentB = allStudents.find((s) => s.id === b.studentId) || {};
        return (studentA.rollNo || "").localeCompare(studentB.rollNo || "");
      });

      // Add each student record - use P/A instead of emojis
      recordsForSession.forEach((record) => {
        const student =
          allStudents.find((s) => s.id === record.studentId) || {};
        const statusText = record.status === "present" ? "P" : "A";
        const timeRecorded = record.createdAt
          ? new Date(record.createdAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "N/A";

        csvContent += `   ${student.rollNo || "N/A"},"${
          student.firstName || ""
        } ${student.lastName || ""}",${statusText},${timeRecorded}\n`;
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

    // Date summary
    csvContent += `   Date Summary: ${datePresent} Present | ${dateAbsent} Absent | ${datePercentage}% Attendance\n`;

    // Add separator between dates (except after the last one)
    if (dateIndex < sortedDates.length - 1) {
      csvContent += "=".repeat(70) + "\n\n";
    } else {
      csvContent += "\n";
    }
  });

  // Add overall summary at the end
  const overallTotal = classRecords.length;
  const overallPresent = classRecords.filter(
    (r) => r.status === "present"
  ).length;
  const overallAbsent = classRecords.filter(
    (r) => r.status === "absent"
  ).length;
  const overallPercentage =
    overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;

  // Count total unique sessions
  const totalUniqueSessions = Object.values(dateGroups).reduce(
    (acc, sessions) => {
      const sessionMap = {};
      sessions.forEach((r) => {
        sessionMap[r.session || 1] = true;
      });
      return acc + Object.keys(sessionMap).length;
    },
    0
  );

  csvContent +=
    "==================================================================\n";
  csvContent += "OVERALL SUMMARY\n";
  csvContent +=
    "==================================================================\n";
  csvContent += `Total Dates: ${sortedDates.length}\n`;
  csvContent += `Total Sessions: ${totalUniqueSessions}\n`;
  csvContent += `Total Records: ${overallTotal}\n`;
  csvContent += `Total Present: ${overallPresent}\n`;
  csvContent += `Total Absent: ${overallAbsent}\n`;
  csvContent += `Overall Attendance: ${overallPercentage}%\n`;
  csvContent += `Export Date: ${new Date().toLocaleString()}\n`;

  // Create filename
  let filename = `attendance_history_${classInfo.code}`;
  if (dateFilter) {
    const datePart = dateFilter.replace(/-/g, "");
    filename += `_${datePart}`;
  } else {
    filename += "_all_dates";
  }
  filename += `_${new Date().getTime()}.csv`;

  // Use the downloadCSV function which will convert to ASCII
  downloadCSV(csvContent, filename);
  showToast(
    `Exported history for ${sortedDates.length} date${
      sortedDates.length !== 1 ? "s" : ""
    }`,
    "success"
  );
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
function addMultiSessionButton() {
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
        const existingForSession = allAttendance.filter(
          (r) =>
            r.classId === classId && r.date === date && r.session === session
        );
        const existingMap = new Map(
          existingForSession.map((r) => [r.studentId, r])
        );

        const promises = [];

        checkboxes.forEach((cb) => {
          const studentId = parseInt(cb.value);
          const status = cb.checked ? "present" : "absent";

          const record = {
            classId: classId,
            studentId: studentId,
            date: date,
            session: session,
            status: status,
            notes: `Session ${session}`,
            createdAt: new Date().toISOString(),
          };

          const existing = existingMap.get(studentId);
          if (existing) {
            record.id = existing.id;
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
      generateYearlyReport();

      // Clear checkboxes after successful submission
      checkboxes.forEach((cb) => (cb.checked = false));
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

  // Pre-fetch existing records to avoid duplication
  const allAttendance = await getAll("attendance");
  const existingForSession = allAttendance.filter(
    (r) => r.classId === classId && r.date === date && r.session === session
  );
  const existingMap = new Map(existingForSession.map((r) => [r.studentId, r]));

  const promises = [];

  checkboxes.forEach((cb) => {
    const studentId = parseInt(cb.value);
    const status = cb.checked ? "present" : "absent";

    const record = {
      classId: classId,
      studentId: studentId,
      date: date,
      session: session,
      status: status,
      notes: `Session ${session}`,
      createdAt: new Date().toISOString(),
    };

    const existing = existingMap.get(studentId);
    if (existing) {
      record.id = existing.id;
      promises.push(updateRecord("attendance", record));
    } else {
      promises.push(addRecord("attendance", record));
    }
  });

  try {
    await Promise.all(promises);
    showToast(
      `Attendance saved for ${checkboxes.length} students in Session ${session}!`
    );
    generateYearlyReport();

    // Clear checkboxes after successful submission
    checkboxes.forEach((cb) => (cb.checked = false));
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

    // Find student
    const student = allStudents.find((s) => s.rollNo === rollNo);
    if (student) {
      // Check existing for this specific session
      const existingRecord = allAttendance.find(
        (r) =>
          r.classId === classId &&
          r.studentId === student.id &&
          r.date === date &&
          r.session === session
      );

      const record = {
        classId: classId,
        studentId: student.id,
        date: date,
        session: session,
        status: status,
        notes: `Session ${session}`,
        createdAt: new Date().toISOString(),
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
  generateYearlyReport();
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
async function viewStudentAttendance(studentId, rollNo, fullName) {
  const allAttendance = await getAll("attendance");
  const allClasses = await getAll("classes");
  const allStudents = await getAll("students");
  const student = allStudents.find((s) => s.id === studentId);

  // Filter attendance for this student
  const studentAttendance = allAttendance.filter(
    (r) => r.studentId === studentId
  );

  if (studentAttendance.length === 0) {
    document.getElementById("detailAttendanceList").innerHTML =
      "<p style='color: gray; text-align: center; padding: 20px;'>No attendance records found.</p>";
  } else {
    // Group by class
    const classMap = {};
    studentAttendance.forEach((record) => {
      if (!classMap[record.classId]) {
        classMap[record.classId] = { total: 0, present: 0, absent: 0 };
      }
      classMap[record.classId].total++;
      if (record.status === "present") {
        classMap[record.classId].present++;
      } else {
        classMap[record.classId].absent++;
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
                <div style='background: white; padding: 12px; border-radius: 6px; border-left: 4px solid ${statusColor}; display: flex; justify-content: space-between; align-items: center;'>
                    <div>
                        <strong>${cls ? cls.code : "N/A"} - ${
        cls ? cls.name : "Unknown"
      }</strong>
                    </div>
                    <div style='text-align: right; font-size: 13px;'>
                        <span style='margin: 0 15px;'><strong>${
                          stats.total
                        }</strong> Total</span>
                        <span style='margin: 0 15px; color: green;'><strong>${
                          stats.present
                        }</strong> Attended</span>
                        <span style='font-weight: bold; color: ${statusColor}; font-size: 14px;'>${percentage}%</span>
                    </div>
                </div>
            `;
    });

    html += "</div>";
    document.getElementById("detailAttendanceList").innerHTML = html;
  }

  // Update modal header
  document.getElementById("detailStudentName").textContent = fullName;
  document.getElementById("detailStudentRoll").textContent = rollNo;
  if (student) {
    document.getElementById("detailStudentDept").textContent =
      student.department;
    document.getElementById("detailStudentSem").textContent =
      "Sem " + student.semester;
  }

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

  // Filter attendance for this class
  let classRecords = allAttendance.filter((r) => r.classId === classId);

  if (classRecords.length === 0) {
    showToast("No attendance records for this class", "info");
    return;
  }

  // Group attendance by student
  const studentMap = {};
  classRecords.forEach((record) => {
    if (!studentMap[record.studentId]) {
      studentMap[record.studentId] = { total: 0, present: 0, absent: 0 };
    }
    studentMap[record.studentId].total++;
    if (record.status === "present") {
      studentMap[record.studentId].present++;
    } else {
      studentMap[record.studentId].absent++;
    }
  });

  // Create CSV
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
    return (studentA?.rollNo || "").localeCompare(studentB?.rollNo || "");
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

    csvLines.push(
      `${student.rollNo},${student.firstName} ${student.lastName},${stats.total},${stats.present},${stats.absent},${percentage}%,${status}`
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
