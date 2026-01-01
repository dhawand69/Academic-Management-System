// database.js - Supabase Database Functions
// CORRECTED FOR ALL LOWERCASE COLUMN NAMES: rollno, firstname, lastname, createdat, updatedat

async function initDB() {
  try {
    await initSupabase();
    console.log("✅ Supabase initialized");
    return true;
  } catch (error) {
    console.error("❌ Supabase failed:", error);
    return false;
  }
}

// ========== GENERIC CRUD OPERATIONS ==========

async function addRecord(table, data) {
  try {
    const validColumns = getValidColumns(table);
    const cleanedData = {};
    
    // Map incoming data to valid columns (convert to exact lowercase)
    validColumns.forEach(column => {
      const sourceKey = Object.keys(data).find(key => 
        key.toLowerCase() === column.toLowerCase()
      );
      
      if (sourceKey && data[sourceKey] !== undefined) {
        cleanedData[column] = data[sourceKey];
      }
    });

    console.log(`[DEBUG] Table: ${table}, Valid columns:`, validColumns);
    console.log(`[DEBUG] Sending to Supabase:`, cleanedData);

    const { data: result, error } = await supabaseClient
      .from(table)
      .insert([cleanedData])
      .select();

    if (error) {
      console.error(`[ERROR] Supabase error details:`, error);
      if (typeof showToast === 'function') {
        showToast(`Error adding to ${table}: ${error.message}`, 'error');
      }
      return null;
    }

    console.log(`✅ Added to ${table}:`, result[0]);
    return result[0];
    
  } catch (error) {
    console.error(`❌ Error adding to ${table}:`, error);
    if (typeof showToast === 'function') {
      showToast(`Error: ${error.message}`, 'error');
    }
    return null;
  }
}

async function getAll(table) {
  try {
    const { data, error } = await supabaseClient
      .from(table)
      .select("*");
    
    if (error) throw error;
    
    console.log(`✅ Fetched ${data?.length || 0} records from ${table}`);
    return data || [];
    
  } catch (error) {
    console.error(`❌ Error fetching from ${table}:`, error);
    return [];
  }
}

async function getRecord(table, id) {
  try {
    const { data, error } = await supabaseClient
      .from(table)
      .select("*")
      .eq("id", id)
      .single();
    
    if (error) throw error;
    return data;
    
  } catch (error) {
    console.error(`❌ Error getting record from ${table}:`, error);
    return null;
  }
}

async function updateRecord(table, record) {
  try {
    const { id, ...updates } = record;
    const validColumns = getValidColumns(table);
    const cleanedUpdates = {};
    
    // Map updates to valid columns
    validColumns.forEach(column => {
      const sourceKey = Object.keys(updates).find(key => 
        key.toLowerCase() === column.toLowerCase()
      );
      
      if (sourceKey && updates[sourceKey] !== undefined) {
        cleanedUpdates[column] = updates[sourceKey];
      }
    });

    // Add updatedat timestamp
    if (validColumns.includes('updatedat')) {
      cleanedUpdates.updatedat = new Date().toISOString();
    }

    const { data, error } = await supabaseClient
      .from(table)
      .update(cleanedUpdates)
      .eq("id", id)
      .select();

    if (error) throw error;
    
    console.log(`✅ Updated ${table}:`, data[0]);
    return data[0];
    
  } catch (error) {
    console.error(`❌ Error updating ${table}:`, error);
    if (typeof showToast === 'function') {
      showToast(`Error updating ${table}: ${error.message}`, 'error');
    }
    return null;
  }
}

async function deleteRecord(table, id) {
  try {
    const { error } = await supabaseClient
      .from(table)
      .delete()
      .eq("id", id);

    if (error) throw error;
    
    console.log(`✅ Deleted from ${table}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error deleting from ${table}:`, error);
    if (typeof showToast === 'function') {
      showToast(`Error deleting from ${table}: ${error.message}`, 'error');
    }
    return false;
  }
}

// ========== COLUMN DEFINITIONS ==========
// ALL LOWERCASE - MATCHING SUPABASE SCHEMA EXACTLY

function getValidColumns(table) {
  const columns = {
    // rollno, firstname, lastname, createdat, updatedat (ALL LOWERCASE)
    students: ['id', 'rollno', 'firstname', 'lastname', 'email', 'department', 'year', 'semester', 'createdat', 'updatedat'],
    faculty: ['id', 'facultyid', 'firstname', 'lastname', 'email', 'department', 'specialization', 'password', 'createdat', 'updatedat'],
    classes: ['id', 'code', 'name', 'department', 'semester', 'faculty', 'year', 'credits', 'createdat', 'updatedat', 'is_active'],
    attendance: ['id', 'classid', 'studentid', 'date', 'session', 'status', 'notes', 'createdat', 'updatedat'],
    academic_years: ['id', 'year', 'startdate', 'enddate', 'type', 'createdat'],
    settings: ['id', 'key', 'value', 'createdat', 'updatedat']
  };

  return columns[table] || [];
}

// ========== TABLE-SPECIFIC CRUD ==========

async function loadStudents() {
  return await getAll('students');
}

async function addStudent(studentData) {
  return await addRecord('students', studentData);
}

async function updateStudent(studentRecord) {
  return await updateRecord('students', studentRecord);
}

async function deleteStudent(id) {
  return await deleteRecord('students', id);
}

async function loadFaculty() {
  return await getAll('faculty');
}

async function addFaculty(facultyData) {
  return await addRecord('faculty', facultyData);
}

async function updateFaculty(facultyRecord) {
  return await updateRecord('faculty', facultyRecord);
}

async function deleteFaculty(id) {
  return await deleteRecord('faculty', id);
}

async function loadClasses() {
  return await getAll('classes');
}

async function addClass(classData) {
  return await addRecord('classes', classData);
}

async function updateClass(classRecord) {
  return await updateRecord('classes', classRecord);
}

async function deleteClass(id) {
  return await deleteRecord('classes', id);
}

async function loadAttendance() {
  return await getAll('attendance');
}

async function markAttendance(attendanceData) {
  return await addRecord('attendance', attendanceData);
}

async function updateAttendance(attendanceRecord) {
  return await updateRecord('attendance', attendanceRecord);
}

async function loadAcademicYears() {
  return await getAll('academic_years');
}

async function addAcademicYear(yearData) {
  return await addRecord('academic_years', yearData);
}

async function saveSetting(key, value) {
  try {
    const existing = await supabaseClient
      .from('settings')
      .select('*')
      .eq('key', key)
      .single();

    if (existing.data) {
      return await updateRecord('settings', {
        id: existing.data.id,
        key: key,
        value: value
      });
    } else {
      return await addRecord('settings', { key, value });
    }

  } catch (error) {
    console.error('Error saving setting:', error);
    return null;
  }
}

// ========== FILTERING & QUERIES ==========

async function getStudentsByDepartment(department) {
  try {
    const { data, error } = await supabaseClient
      .from('students')
      .select('*')
      .eq('department', department);
    
    if (error) throw error;
    return data || [];
    
  } catch (error) {
    console.error('Error filtering students:', error);
    return [];
  }
}

async function getAttendanceByClass(classId, date = null) {
  try {
    let query = supabaseClient
      .from('attendance')
      .select('*')
      .eq('classid', classId);  // LOWERCASE: classid

    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
    
  } catch (error) {
    console.error('Error getting attendance:', error);
    return [];
  }
}

async function getClassesByFaculty(facultyName) {
  try {
    const { data, error } = await supabaseClient
      .from('classes')
      .select('*')
      .eq('faculty', facultyName);
    
    if (error) throw error;
    return data || [];
    
  } catch (error) {
    console.error('Error getting classes:', error);
    return [];
  }
}

// ========== CLEAR STORE FOR IMPORTS ==========

async function clearStore(storeName) {
  try {
    const allRecords = await getAll(storeName);
    
    for (const record of allRecords) {
      await deleteRecord(storeName, record.id);
    }

    console.log(`✅ Cleared store: ${storeName}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error clearing store ${storeName}:`, error);
    return false;
  }
}
