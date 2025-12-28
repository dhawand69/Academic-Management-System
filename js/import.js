// import.js - Data Import Functions with Sanitization
// CORRECTED: Includes Safe Wipe & Full JSON/ZIP Support

// ========== COLUMN SANITIZATION FUNCTION ==========
function sanitizeRecord(store, record) {
  const validColumns = {
    students: ['id', 'rollno', 'firstname', 'lastname', 'email', 'department', 'year', 'semester', 'createdat', 'updatedat'],
    faculty: ['id', 'facultyid', 'firstname', 'lastname', 'email', 'department', 'specialization', 'password', 'createdat', 'updatedat'],
    classes: ['id', 'code', 'name', 'department', 'semester', 'faculty', 'year', 'credits', 'createdat', 'updatedat'],
    attendance: ['id', 'classid', 'studentid', 'date', 'session', 'status', 'notes', 'createdat', 'updatedat'],
    academic_years: ['id', 'year', 'startdate', 'enddate', 'type', 'createdat'],
    settings: ['id', 'key', 'value', 'createdat', 'updatedat']
  };

  const cleanedRecord = {};
  const columns = validColumns[store] || [];

  columns.forEach(column => {
    // Find matching key - convert both to lowercase for comparison
    const sourceKey = Object.keys(record).find(key => 
      key.toLowerCase() === column.toLowerCase()
    );

    if (sourceKey && record[sourceKey] !== undefined && record[sourceKey] !== null) {
      cleanedRecord[column] = record[sourceKey];
    }
  });

  return Object.keys(cleanedRecord).length > 0 ? cleanedRecord : record;
}

// ========== CRITICAL: DATABASE WIPE FUNCTION ==========
// Clears tables in specific order to avoid Foreign Key conflicts
async function wipeDatabase(progressBar) {
  console.log("🧹 Starting Safe Database Wipe...");
  if(progressBar) progressBar.textContent = "Cleaning old data...";

  // 1. Delete Children First (Attendance) - Frees up Classes
  await clearStore('attendance');
  if(progressBar) progressBar.style.width = '15%';

  // 2. Delete Classes - Frees up Faculty
  await clearStore('classes');
  if(progressBar) progressBar.style.width = '30%';

  // 3. Delete Independent Tables
  await clearStore('students');
  await clearStore('faculty');
  await clearStore('academic_years');
  await clearStore('settings');
  
  if(progressBar) progressBar.style.width = '45%';
  console.log("✅ Database Wiped Clean");
}

// ========== FUNCTION 1: importStructuredData (ZIP) ==========

async function importStructuredData(zipContent, progressBar) {
  // WIPE FIRST
  await wipeDatabase(progressBar);

  // Import in Dependency Order: Faculty -> Classes -> Attendance
  const stores = ['students', 'faculty', 'classes', 'attendance', 'academic_years', 'settings'];

  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    const file = zipContent.file(store + '.json');

    if (file) {
      try {
        const text = await file.async('text');
        const data = JSON.parse(text);

        let count = 0;
        for (const item of data) {
          const cleanedItem = sanitizeRecord(store, item);
          await addRecord(store, cleanedItem);
          count++;
        }
        console.log(`✅ Imported ${count} records to ${store}`);

      } catch (error) {
        console.error(`Error importing ${store}:`, error);
        if (typeof showToast === 'function') showToast(`Failed to import ${store}`, 'error');
      }
    }

    const percent = 45 + Math.round(((i + 1) / stores.length) * 55);
    if(progressBar) {
        progressBar.style.width = percent + '%';
        progressBar.textContent = percent + '%';
    }
  }
}

// ========== FUNCTION 2: importIndividualFiles (ZIP) ==========

async function importIndividualFiles(zipContent, progressBar) {
  // WIPE FIRST
  await wipeDatabase(progressBar);

  const fileMappings = {
    students: ['students.json', 'students.csv'],
    faculty: ['faculty.json', 'faculty.csv'],
    classes: ['classes.json', 'classes.csv'],
    attendance: ['attendance.json', 'attendance.csv'],
    academic_years: ['academic_years.json', 'years.json'],
    settings: ['settings.json']
  };

  let processed = 0;
  const total = Object.keys(fileMappings).length;
  const orderedStores = ['students', 'faculty', 'classes', 'attendance', 'academic_years', 'settings'];

  for (const store of orderedStores) {
    const possibleFiles = fileMappings[store];
    
    for (const fileName of possibleFiles) {
      const file = zipContent.file(fileName);

      if (file) {
        try {
          const text = await file.async('text');
          let data;

          if (fileName.endsWith('.json')) {
            data = JSON.parse(text);
          } else if (fileName.endsWith('.csv')) {
            data = parseCSVToObjects(text);
          }

          if (data && data.length > 0) {
            for (const item of data) {
              const cleanedItem = sanitizeRecord(store, item);
              await addRecord(store, cleanedItem);
            }
            console.log(`✅ Imported ${data.length} records to ${store}`);
            break; 
          }

        } catch (error) {
          console.error(`Error importing from ${fileName}:`, error);
        }
      }
    }

    processed++;
    const percent = 45 + Math.round((processed / total) * 55);
    if(progressBar) {
        progressBar.style.width = percent + '%';
        progressBar.textContent = percent + '%';
    }
  }
}

// ========== FUNCTION 3: importFromStructuredJSON (Single File) ==========

async function importFromStructuredJSON(completeData, progressBar) {
  // WIPE FIRST
  await wipeDatabase(progressBar);

  const stores = ['students', 'faculty', 'classes', 'attendance', 'academic_years', 'settings'];

  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    const data = completeData.data[store];

    if (data && Array.isArray(data)) {
      try {
        let count = 0;
        for (const item of data) {
          const cleanedItem = sanitizeRecord(store, item);
          await addRecord(store, cleanedItem);
          count++;
        }
        console.log(`✅ Imported ${count} records to ${store}`);

      } catch (error) {
        console.error(`Error importing ${store}:`, error);
      }
    }

    const percent = 45 + Math.round(((i + 1) / stores.length) * 55);
    if(progressBar) {
        progressBar.style.width = percent + '%';
        progressBar.textContent = percent + '%';
    }
  }
}

// ========== FUNCTION 4: importFromLegacyJSON (Single File) ==========

async function importFromLegacyJSON(data, progressBar) {
  // WIPE FIRST
  await wipeDatabase(progressBar);

  const stores = ['students', 'faculty', 'classes', 'attendance', 'academic_years', 'settings'];

  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];

    if (data[store] && Array.isArray(data[store])) {
      try {
        let count = 0;
        for (const item of data[store]) {
          const cleanedItem = sanitizeRecord(store, item);
          await addRecord(store, cleanedItem);
          count++;
        }
        console.log(`✅ Imported ${data[store].length} records to ${store}`);

      } catch (error) {
        console.error(`Error importing ${store}:`, error);
      }
    }

    const percent = 45 + Math.round(((i + 1) / stores.length) * 55);
    if(progressBar) {
        progressBar.style.width = percent + '%';
        progressBar.textContent = percent + '%';
    }
  }
}

// ========== CSV PARSER ==========

function parseCSVToObjects(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(',')
    .map(h => h.trim().replace(/^"|"$/g, ''));

  const objects = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;

    const values = [];
    let current = '';
    let inQuotes = false;

    for (let char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));

    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });

    objects.push(obj);
  }

  return objects;
}

// ========== MAIN IMPORT HANDLER ==========

async function handleCompleteDbUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const progressDiv = document.getElementById('importProgress') || document.getElementById('completeDbProgress');
  const progressBar = progressDiv?.querySelector('.progress-fill') || document.getElementById('completeDbProgressBar');

  if (progressDiv) progressDiv.style.display = 'block';
  if (progressBar) {
    progressBar.style.width = '5%';
    progressBar.textContent = '5%';
  }

  try {
    if (file.name.endsWith('.zip')) {
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library not loaded. Cannot process ZIP files.');
      }

      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);

      const hasStructuredFiles = (
        zipContent.file('students.json') !== null ||
        zipContent.file('faculty.json') !== null ||
        zipContent.file('classes.json') !== null ||
        zipContent.file('attendance.json') !== null
      );

      if (hasStructuredFiles) {
        await importStructuredData(zipContent, progressBar);
      } else {
        await importIndividualFiles(zipContent, progressBar);
      }

    } else if (file.name.endsWith('.json')) {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.data && typeof data.data === 'object') {
        await importFromStructuredJSON(data, progressBar);
      } else {
        await importFromLegacyJSON(data, progressBar);
      }

    } else {
      throw new Error('Unsupported file format. Please use ZIP or JSON.');
    }

    if (progressBar) {
      progressBar.style.width = '100%';
      progressBar.textContent = '100%';
    }

    showToast('✅ Database imported successfully! Refreshing data...', 'success');

    setTimeout(async () => {
      if (typeof loadStudents === 'function') await loadStudents();
      if (typeof loadFaculty === 'function') await loadFaculty();
      if (typeof loadClasses === 'function') await loadClasses();
      if (typeof loadAcademicYears === 'function') await loadAcademicYears();
      if (typeof updateDashboard === 'function') await updateDashboard();
      if (progressDiv) progressDiv.style.display = 'none';
    }, 1000);

  } catch (error) {
    console.error('❌ Import error:', error);
    if (typeof showToast === 'function') {
      showToast(`❌ Import failed: ${error.message}`, 'error');
    }
    if (progressDiv) progressDiv.style.display = 'none';
  }

  event.target.value = '';
}
