// js/import.js - Handles Bulk Data Imports (CSV)
// UPDATED: Supports Multi-Branch parsing (handles quoted CSV fields)

// ==========================================
// 1. ROBUST CSV PARSING (The Fix)
// ==========================================

/**
 * Parses a single CSV line, respecting quotes.
 * Handles: "Civil,Mechanical", "Doe, John", etc.
 */
function parseCSVLine(text) {
    // Regex to match CSV fields:
    // 1. Single Quoted '...'
    // 2. Double Quoted "..."
    // 3. Unquoted values (no commas)
    const re_value = /(?!\s*$)\s*(?:'([^']*)'|"([^"]*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    
    const a = [];
    
    text.replace(re_value, function(m0, m1, m2, m3) {
        // m1: Single quoted value
        if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
        // m2: Double quoted value (This is what we need for "Civil,Mechanical")
        else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
        // m3: Unquoted value
        else if (m3 !== undefined) a.push(m3);
        return '';
    });
    
    // Handle special case of empty last value (e.g. "a,b,")
    if (/,\s*$/.test(text)) a.push('');
    return a;
}

/**
 * Parses the full CSV content into an array of objects
 */
function parseCSV(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    // Parse Headers
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    
    const data = [];

    // Parse Rows
    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i];
        if (!currentLine) continue;

        const values = parseCSVLine(currentLine);

        // Map headers to values
        if (values.length === headers.length) {
            const obj = {};
            headers.forEach((header, index) => {
                let val = values[index];
                // Clean up any remaining quotes if regex missed them (rare)
                if (typeof val === 'string') val = val.trim(); 
                obj[header] = val;
            });
            data.push(obj);
        } else {
            console.warn(`Skipping line ${i + 1}: Column count mismatch. Expected ${headers.length}, got ${values.length}.`);
        }
    }
    return data;
}

// ==========================================
// 2. IMPORT HANDLERS
// ==========================================

// Triggered by the "Import" buttons in the UI
function triggerImport(type) {
    // Create a hidden file input dynamically
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    
    input.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            processFile(file, type);
        }
    };
    
    input.click();
}

function processFile(file, type) {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        const content = e.target.result;
        try {
            const parsedData = parseCSV(content);
            
            if (parsedData.length === 0) {
                showToast("CSV is empty or invalid format.", "error");
                return;
            }

            await importDataToDB(type, parsedData);
            
        } catch (error) {
            console.error("CSV Parse Error:", error);
            showToast("Error parsing CSV file.", "error");
        }
    };
    
    reader.readAsText(file);
}

// ==========================================
// 3. DATABASE IMPORT LOGIC
// ==========================================

async function importDataToDB(type, data) {
    const total = data.length;
    showProgressModal(`Importing ${type}...`);
    
    let successCount = 0;
    let failCount = 0;

    // Optional: Clear existing data before import?
    // Uncomment next line if you want to wipe the table first:
    // await clearStore(type);

    for (let i = 0; i < total; i++) {
        const row = data[i];
        let record = null;

        updateProgress(i + 1, total, `Processing row ${i + 1} of ${total}`);

        try {
            // DATA MAPPING & CLEANING
            switch (type) {
                case 'students':
                    record = {
                        rollno: row.rollno,
                        firstname: row.firstname,
                        lastname: row.lastname,
                        email: row.email,
                        department: row.department,
                        year: parseInt(row.year) || 1,
                        semester: parseInt(row.semester) || 1,
                        createdat: new Date().toISOString()
                    };
                    break;

                case 'faculty':
                    record = {
                        facultyid: row.facultyid,
                        firstname: row.firstname,
                        lastname: row.lastname,
                        email: row.email,
                        department: row.department,
                        specialization: row.specialization,
                        password: row.password || 'password123', // Default password
                        createdat: new Date().toISOString()
                    };
                    break;

                case 'classes':
                    // This is where the Multi-Branch fix shines
                    // "row.department" will correctly be "Civil,Mechanical" 
                    // thanks to parseCSVLine()
                    record = {
                        code: row.code,
                        name: row.name,
                        department: row.department, 
                        semester: parseInt(row.semester),
                        faculty: row.faculty,
                        year: parseInt(row.year),
                        credits: parseInt(row.credits),
                        createdat: new Date().toISOString()
                    };
                    break;
            }

            if (record) {
                const result = await addRecord(type, record);
                if (result) successCount++;
                else failCount++;
            }

        } catch (err) {
            console.error(`Row ${i} failed:`, err);
            failCount++;
        }
    }

    hideProgressModal();
    
    const msg = `Import Complete!\nSuccess: ${successCount}\nFailed: ${failCount}`;
    showToast(msg, failCount > 0 ? "warning" : "success");
    
    // Refresh UI Tables
    if (type === 'students') loadStudents();
    if (type === 'faculty') loadFaculty();
    if (type === 'classes') loadClasses();
}

// ==========================================
// 4. UI HELPERS (Progress Bar)
// ==========================================

function showProgressModal(title) {
    let modal = document.getElementById('progressModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'progressModal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); display: flex; align-items: center; 
            justify-content: center; z-index: 10000;
        `;
        modal.innerHTML = `
            <div style="background:white; padding:20px; border-radius:8px; width:300px; text-align:center;">
                <h3 id="pTitle" style="margin-bottom:15px;">${title}</h3>
                <div style="background:#eee; height:20px; border-radius:10px; overflow:hidden;">
                    <div id="pBar" style="background:#3498db; height:100%; width:0%; transition:width 0.2s;"></div>
                </div>
                <p id="pText" style="margin-top:10px; font-size:12px; color:#666;">Starting...</p>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        document.getElementById('pTitle').textContent = title;
        modal.style.display = 'flex';
    }
}

function updateProgress(current, total, text) {
    const percent = Math.round((current / total) * 100);
    const bar = document.getElementById('pBar');
    const txt = document.getElementById('pText');
    if (bar) bar.style.width = `${percent}%`;
    if (txt) txt.textContent = `${text} (${percent}%)`;
}

function hideProgressModal() {
    const modal = document.getElementById('progressModal');
    if (modal) modal.style.display = 'none';
}
