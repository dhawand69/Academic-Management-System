// marks.js - Handles Internal Marks Logic

// ==========================================
// FACULTY: LOAD & UPDATE MARKS
// ==========================================

async function populateFacultyMarksDropdown() {
    const classes = await getAll("classes");
    const select = document.getElementById("facultyMarksClassSelect");
    const adminSelect = document.getElementById("adminMarksClassFilter");
    
    if (select) select.innerHTML = '<option value="">-- Select a class --</option>';
    if (adminSelect) adminSelect.innerHTML = '<option value="">-- Select a class --</option>';

    if (!currentUser) return;

    // Filter classes based on role
    let myClasses = [];
    if (currentUser.role === 'admin') {
        myClasses = classes; // Admin sees all
    } else {
        const facultyName = `${currentUser.firstname} ${currentUser.lastname}`;
        myClasses = classes.filter(c => c.faculty.trim().toLowerCase() === facultyName.trim().toLowerCase());
    }

    // Populate Dropdowns
    myClasses.forEach(cls => {
        const opt = document.createElement("option");
        opt.value = cls.id;
        opt.textContent = `${cls.code}: ${cls.name}`;
        
        if (select) select.appendChild(opt.cloneNode(true));
        if (adminSelect) adminSelect.appendChild(opt);
    });
}

async function loadFacultyMarksTable() {
    const classId = parseInt(document.getElementById("facultyMarksClassSelect").value);
    const container = document.getElementById("marksEntryContainer");
    const tbody = document.getElementById("facultyMarksBody");

    if (!classId) {
        container.style.display = "none";
        return;
    }

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading students and marks...</td></tr>';
    container.style.display = "block";

    try {
        const [allStudents, allClasses, allMarks] = await Promise.all([
            getAll("students"),
            getAll("classes"),
            getAll("internal_marks")
        ]);

        const cls = allClasses.find(c => c.id === classId);
        
        // Filter students for this class (Dept + Sem match)
        const classStudents = allStudents.filter(s => 
            s.department === cls.department && s.semester == cls.semester
        );

        // Sort by Roll No
        classStudents.sort((a, b) => (a.rollno || "").localeCompare(b.rollno || ""));

        // Filter existing marks for this class
        const existingMarks = allMarks.filter(m => m.classid === classId);
        const marksMap = new Map(existingMarks.map(m => [m.studentid, m]));

        tbody.innerHTML = "";

        if (classStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No students found for this class.</td></tr>';
            return;
        }

        classStudents.forEach(student => {
            const marks = marksMap.get(student.id) || { midsem: 0, assignment: 0, attendance: 0, total: 0 };
            
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

    } catch (error) {
        console.error("Error loading marks:", error);
        showToast("Error loading data", "error");
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

// Added this function to handle the "Max Marks" input change
function recalculateAllTotals() {
    const rows = document.querySelectorAll("#facultyMarksBody tr");
    rows.forEach(row => {
        const input = row.querySelector(".midsem"); 
        if(input) calculateRowTotal(input);
    });
}

async function saveInternalMarks() {
    const classId = parseInt(document.getElementById("facultyMarksClassSelect").value);
    if (!classId) return;

    showToast("Saving marks...", "info");

    const rows = document.querySelectorAll("#facultyMarksBody tr");
    const allMarks = await getAll("internal_marks");
    
    // Find existing marks for this class to update/insert correctly
    const existingMarksMap = new Map(
        allMarks.filter(m => m.classid === classId).map(m => [m.studentid, m])
    );

    const promises = [];

    rows.forEach(row => {
        const midInput = row.querySelector(".midsem");
        if (!midInput) return; // Header or empty row

        const studentId = parseInt(midInput.dataset.sid);
        const mid = parseFloat(midInput.value) || 0;
        const ass = parseFloat(row.querySelector(".assign").value) || 0;
        const att = parseFloat(row.querySelector(".att").value) || 0;
        const total = parseFloat(document.getElementById(`total-${studentId}`).textContent) || 0;

        const record = {
            classid: classId,
            studentid: studentId,
            midsem: mid,
            assignment: ass,
            attendance: att,
            total: total,
            updatedat: new Date().toISOString()
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
// ADMIN: VIEW & EXPORT MARKS
// ==========================================

async function loadAdminMarksTable() {
    const classId = parseInt(document.getElementById("adminMarksClassFilter").value);
    const tbody = document.querySelector("#adminMarksTable tbody");
    tbody.innerHTML = "";

    if (!classId) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Select a class to view marks.</td></tr>';
        return;
    }

    const [allStudents, allMarks] = await Promise.all([
        getAll("students"),
        getAll("internal_marks")
    ]);

    const classMarks = allMarks.filter(m => m.classid === classId);

    if (classMarks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No marks uploaded for this class yet.</td></tr>';
        return;
    }

    classMarks.forEach(mark => {
        const student = allStudents.find(s => s.id === mark.studentid) || {};
        
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${student.rollno || 'N/A'}</td>
            <td>${student.firstname} ${student.lastname}</td>
            <td>${mark.midsem}</td>
            <td>${mark.assignment}</td>
            <td>${mark.attendance}</td>
            <td style="font-weight:bold;">${mark.total}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function exportInternalMarksCSV() {
    const classId = parseInt(document.getElementById("adminMarksClassFilter").value);
    if (!classId) {
        showToast("Select a class first", "error");
        return;
    }

    const [allStudents, allMarks, allClasses] = await Promise.all([
        getAll("students"),
        getAll("internal_marks"),
        getAll("classes")
    ]);

    const cls = allClasses.find(c => c.id === classId);
    const classMarks = allMarks.filter(m => m.classid === classId);

    let csvContent = `Internal Marks Report - ${cls.code} (${cls.name})\n`;
    csvContent += `Roll No,Name,Mid-Sem,Assignment,Attendance,Total\n`;

    classMarks.forEach(mark => {
        const student = allStudents.find(s => s.id === mark.studentid) || {};
        const name = `${student.firstname} ${student.lastname}`.replace(/,/g, ""); 
        
        csvContent += `${student.rollno},${name},${mark.midsem},${mark.assignment},${mark.attendance},${mark.total}\n`;
    });

    downloadCSV(csvContent, `InternalMarks_${cls.code}.csv`);
}
