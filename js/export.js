// export.js - Handles Data Export & Backup Logic

// Toggle all export checkboxes
function toggleExportCheckboxes(state) {
    const ids = ['expStudents', 'expFaculty', 'expClasses', 'expYears', 'expAttendance', 'expInternalMarks', 'expSettings'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.checked = state;
    });
}

// Main Export Handler
async function handleCustomExport(format) {
    showToast("Preparing export data...", "info");

    // 1. Identify what to export
    const selection = {
        students: document.getElementById('expStudents').checked,
        faculty: document.getElementById('expFaculty').checked,
        classes: document.getElementById('expClasses').checked,
        academic_years: document.getElementById('expYears').checked,
        attendance: document.getElementById('expAttendance').checked,
        internal_marks: document.getElementById('expInternalMarks').checked,
        settings: document.getElementById('expSettings').checked
    };

    // 2. Fetch Data
    const exportData = {};
    const promises = [];

    for (const [key, isSelected] of Object.entries(selection)) {
        if (isSelected) {
            promises.push(
                getAll(key).then(data => {
                    exportData[key] = data;
                })
            );
        }
    }

    await Promise.all(promises);

    const keysFound = Object.keys(exportData);
    if (keysFound.length === 0) {
        showToast("Please select at least one dataset to export.", "warning");
        return;
    }

    // 3. Handle Formats
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    if (format === 'json') {
        // --- JSON BACKUP ---
        const finalObj = {
            meta: {
                version: "3.0",
                generatedAt: new Date().toISOString(),
                description: "Partial/Full System Backup"
            },
            data: exportData
        };

        const blob = new Blob([JSON.stringify(finalObj, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Backup_${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Backup JSON downloaded!", "success");

    } else if (format === 'csv') {
        // --- CSV / ZIP EXPORT ---
        if (typeof JSZip === 'undefined') {
            showToast("JSZip library missing. Cannot zip files.", "error");
            return;
        }

        const zip = new JSZip();
        
        // Convert each table to CSV and add to zip
        keysFound.forEach(key => {
            const data = exportData[key];
            if (data && data.length > 0) {
                const csvStr = convertToCSV(data);
                zip.file(`${key}.csv`, csvStr);
            }
        });

        // Generate Zip
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `Export_${timestamp}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Export ZIP downloaded!", "success");
    }
}

// Helper: Convert Array of Objects to CSV string
function convertToCSV(objArray) {
    if (!objArray || objArray.length === 0) return "";
    
    // Get headers from first object
    const headers = Object.keys(objArray[0]);
    const csvRows = [];
    
    // Add Header Row
    csvRows.push(headers.join(','));
    
    // Add Data Rows
    for (const row of objArray) {
        const values = headers.map(header => {
            const val = row[header];
            // Handle null/undefined and escape quotes
            const escaped = ('' + (val === null || val === undefined ? '' : val)).replace(/"/g, '\\"');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
}

// Helper: Download Template
function downloadTemplate(type) {
    let csvContent = "";
    
    // Define headers based on DB Schema
    switch(type) {
        case 'students': 
            csvContent = "rollno,firstname,lastname,email,department,year,semester"; break;
        case 'faculty': 
            csvContent = "facultyid,firstname,lastname,email,department,specialization,password"; break;
        case 'classes': 
            csvContent = "code,name,department,semester,faculty,year,credits,max_midsem,max_assignment,max_attendance"; break;
        case 'internal_marks':
            csvContent = "classid,studentid,midsem,assignment,attendance,total"; break;
        default: return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Template_${type}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
