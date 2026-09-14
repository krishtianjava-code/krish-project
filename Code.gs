const SHEET_NAMES = {
  reports: 'Laporan',
  users: 'Pengguna'
};

const PHOTO_FOLDER_PROPERTY = 'PHOTO_FOLDER_ID';
const ADMIN_USERNAME_PROPERTY = 'ADMIN_USERNAME';
const ADMIN_PASSWORD_HASH_PROPERTY = 'ADMIN_PASSWORD_HASH';
const SESSION_PREFIX = 'APP_SESSION_';
const SESSION_SECONDS = 21600;
const USER_HEADERS = ['nis', 'name', 'passwordHash', 'className', 'createdAt'];
const PUBLIC_STATUS_LABELS = {
  open: 'Belum diambil',
  done: 'Sudah diambil'
};

const REPORT_HEADERS = [
  'id', 'createdAt', 'updatedAt', 'type', 'title', 'description',
  'location', 'dateFoundOrLost', 'reporterName', 'reporterClass',
  'reporterNis', 'reporterRole', 'contact', 'status', 'photoUrl', 'claimedBy', 'notes'
];

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('TemuKembali | Laporan Barang Sekolah')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setupApp() {
  const spreadsheet = getSpreadsheet_();
  const reportsSheet = getOrCreateSheet_(spreadsheet, SHEET_NAMES.reports, REPORT_HEADERS);
  ensureReportHeaders_(reportsSheet);
  const usersSheet = getOrCreateSheet_(spreadsheet, SHEET_NAMES.users, USER_HEADERS);
  ensureUserHeaders_(usersSheet);
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());
  initializeAdminCredentials_();
  reportsSheet.setFrozenRows(1);
  return { spreadsheetUrl: spreadsheet.getUrl(), message: 'Database siap digunakan.' };
}

function setAdminCredentials_(username, password) {
  const safeUsername = String(username || '').trim();
  const safePassword = String(password || '');
  if (!safeUsername || safeUsername.length > 100) throw new Error('Username admin tidak valid.');
  if (safePassword.length < 8) throw new Error('Password admin minimal 8 karakter.');
  PropertiesService.getScriptProperties().setProperties({
    ADMIN_USERNAME: safeUsername,
    ADMIN_PASSWORD_HASH: hashPassword_(safePassword)
  });
  return 'Kredensial admin berhasil disimpan.';
}

function initializeAdminCredentials_() {
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty(ADMIN_USERNAME_PROPERTY)) properties.setProperty(ADMIN_USERNAME_PROPERTY, 'admin');
  if (!properties.getProperty(ADMIN_PASSWORD_HASH_PROPERTY)) {
    properties.setProperty(ADMIN_PASSWORD_HASH_PROPERTY, hashPassword_('admin1234'));
  }
}

function loginUser(username, password) {
  setupApp();
  const properties = PropertiesService.getScriptProperties();
  const configuredUsername = properties.getProperty(ADMIN_USERNAME_PROPERTY);
  const configuredHash = properties.getProperty(ADMIN_PASSWORD_HASH_PROPERTY);
  const login = String(username || '').trim();
  const secret = String(password || '');
  let user;
  if (login === configuredUsername && hashPassword_(secret) === configuredHash) {
    user = { accountType: 'admin', username: configuredUsername, name: 'Administrator', className: '' };
  } else {
    user = findUserByNis_(login);
    if (!user || hashPassword_(secret) !== user.passwordHash) throw new Error('NIS/username atau password salah.');
    user.accountType = 'siswa';
  }
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(SESSION_PREFIX + token, JSON.stringify(user), SESSION_SECONDS);
  return { token: token, user: publicUser_(user) };
}

function logoutUser(token) {
  if (token) CacheService.getScriptCache().remove(SESSION_PREFIX + String(token));
  return { loggedOut: true };
}

function registerStudent(token, payload) {
  const session = requireSession_(token, 'admin');
  if (!session) throw new Error('Hanya admin yang dapat mendaftarkan siswa.');
  setupApp();
  const nis = clean_(payload && payload.nis);
  const name = clean_(payload && payload.name);
  const className = clean_(payload && payload.className);
  const password = String(payload && payload.password || '');
  if (!nis || !name || !className || password.length < 6) {
    throw new Error('NIS, nama, kelas, dan password minimal 6 karakter wajib diisi.');
  }
  if (findUserByNis_(nis)) throw new Error('NIS tersebut sudah terdaftar.');
  getSpreadsheet_().getSheetByName(SHEET_NAMES.users).appendRow([nis, name, hashPassword_(password), className, new Date().toISOString()]);
  return { message: 'Akun siswa berhasil didaftarkan.', student: { nis: nis, name: name, className: className } };
}

function listStudents(token) {
  requireSession_(token, 'admin');
  setupApp();
  const sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.users);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getDataRange().getValues().slice(1).map(function(row) {
    return { nis: String(row[0] || ''), name: String(row[1] || ''), className: String(row[3] || '') };
  }).filter(function(student) { return student.nis; });
}

function getAppData(token, filters) {
  requireSession_(token);
  setupApp();
  const reports = readReports_();
  const safeFilters = filters || {};
  const query = String(safeFilters.query || '').trim().toLowerCase();
  const type = String(safeFilters.type || 'all');
  const status = String(safeFilters.status || 'all');

  const visibleReports = reports.filter(function(report) {
    const searchable = [report.title, report.description, report.location, report.reporterName]
      .join(' ').toLowerCase();
    const matchesStatus = status === PUBLIC_STATUS_LABELS.open
      ? report.status !== 'Selesai'
      : (status === 'all' || (status === PUBLIC_STATUS_LABELS.done ? report.status === 'Selesai' : report.status === status));
    return (!query || searchable.indexOf(query) !== -1) &&
      (type === 'all' || report.type === type) &&
      matchesStatus;
  });

  return {
    reports: visibleReports,
    stats: {
      total: reports.length,
      open: reports.filter(function(item) { return item.status !== 'Selesai'; }).length,
      found: reports.filter(function(item) { return item.type === 'Temuan' && item.status !== 'Selesai'; }).length,
      returned: reports.filter(function(item) { return item.status === 'Selesai'; }).length
    }
  };
}

function saveReport(token, payload) {
  const session = requireSession_(token);
  setupApp();
  validateReport_(payload);
  const now = new Date().toISOString();
  const photoUrl = payload.photoData
    ? uploadPhoto_(payload.photoData, payload.photoName, payload.type)
    : clean_(payload.photoUrl);
  const report = {
    id: Utilities.getUuid(),
    createdAt: now,
    updatedAt: now,
    type: payload.type,
    title: clean_(payload.title),
    description: clean_(payload.description),
    location: clean_(payload.location),
    dateFoundOrLost: clean_(payload.dateFoundOrLost),
    reporterName: session.name,
    reporterClass: session.className || 'Admin',
    reporterNis: session.nis || '',
    reporterRole: session.accountType === 'admin' ? 'Admin' : 'Siswa',
    contact: clean_(payload.contact),
    status: 'Dilaporkan',
    photoUrl: photoUrl,
    claimedBy: '',
    notes: ''
  };
  appendRow_(SHEET_NAMES.reports, report);
  return { message: 'Laporan berhasil dikirim.', report: report };
}

function updateReport(token, id, payload) {
  const session = requireSession_(token);
  setupApp();
  validateReport_(payload);
  const sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.reports);
  const values = sheet.getDataRange().getValues();
  const idColumn = REPORT_HEADERS.indexOf('id');
  for (let row = 1; row < values.length; row += 1) {
    if (String(values[row][idColumn]) === String(id)) {
      const report = rowToReport_(values[row]);
      if (session.accountType !== 'admin' && report.reporterNis !== session.nis) throw new Error('Anda hanya dapat mengubah laporan sendiri.');
      report.updatedAt = new Date().toISOString();
      report.type = payload.type;
      report.title = clean_(payload.title);
      report.description = clean_(payload.description);
      report.location = clean_(payload.location);
      report.dateFoundOrLost = clean_(payload.dateFoundOrLost);
      report.contact = clean_(payload.contact);
      if (payload.photoData) report.photoUrl = uploadPhoto_(payload.photoData, payload.photoName, payload.type);
      sheet.getRange(row + 1, 1, 1, REPORT_HEADERS.length).setValues([reportToRow_(report)]);
      return { message: 'Laporan berhasil diperbarui.', report: report };
    }
  }
  throw new Error('Laporan tidak ditemukan.');
}

function uploadPhoto_(dataUrl, originalName, reportType) {
  const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|gif|webp));base64,([\s\S]+)$/i);
  if (!match) throw new Error('Format gambar tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 5 * 1024 * 1024) throw new Error('Ukuran gambar maksimal 5 MB.');
  const folderId = PropertiesService.getScriptProperties().getProperty(PHOTO_FOLDER_PROPERTY);
  const folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.createFolder('TemuKembali - Foto Laporan');
  if (!folderId) PropertiesService.getScriptProperties().setProperty(PHOTO_FOLDER_PROPERTY, folder.getId());
  const safeName = clean_(originalName || 'foto-laporan').replace(/[^a-zA-Z0-9._-]/g, '-');
  const file = folder.createFile(Utilities.newBlob(bytes, match[1], reportType + '-' + Date.now() + '-' + safeName));
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (error) {
    // Kebijakan domain dapat melarang sharing publik; akses Drive tetap berlaku.
  }
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

function updateReportStatus(token, id, status, actorName, note, actorRole) {
  requireSession_(token, 'admin');
  setupApp();
  const allowedStatuses = ['Dilaporkan', 'Diproses', 'Selesai'];
  if (allowedStatuses.indexOf(status) === -1) throw new Error('Status tidak valid.');
  if (!clean_(actorName)) throw new Error('Nama pengubah wajib diisi.');

  const sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.reports);
  const values = sheet.getDataRange().getValues();
  const idColumn = REPORT_HEADERS.indexOf('id');
  for (let row = 1; row < values.length; row += 1) {
    if (String(values[row][idColumn]) === String(id)) {
      const report = rowToReport_(values[row]);
      report.updatedAt = new Date().toISOString();
      report.status = status;
      report.notes = clean_(note);
      if (status === 'Selesai') report.claimedBy = clean_(actorName);
      sheet.getRange(row + 1, 1, 1, REPORT_HEADERS.length).setValues([reportToRow_(report)]);
      return { message: 'Status laporan diperbarui.', report: report };
    }
  }
  throw new Error('Laporan tidak ditemukan.');
}

function getSpreadsheet_() {
  const configuredId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (configuredId) return SpreadsheetApp.openById(configuredId);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  return SpreadsheetApp.create('Database TemuKembali Sekolah');
}

function getOrCreateSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function readReports_() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.reports);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getDataRange().getValues().slice(1).map(rowToReport_).reverse();
}

function appendRow_(sheetName, report) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  sheet.appendRow(reportToRow_(report));
}

function rowToReport_(row) {
  const report = {};
  REPORT_HEADERS.forEach(function(header, index) {
    report[header] = row[index] instanceof Date ? row[index].toISOString() : String(row[index] || '');
  });
  return report;
}

function reportToRow_(report) {
  return REPORT_HEADERS.map(function(header) { return report[header] || ''; });
}

function validateReport_(payload) {
  if (!payload || ['Hilang', 'Temuan'].indexOf(payload.type) === -1) throw new Error('Jenis laporan tidak valid.');
  ['title', 'description', 'location', 'dateFoundOrLost', 'contact']
    .forEach(function(field) {
      if (!clean_(payload[field])) throw new Error('Kolom ' + field + ' wajib diisi.');
    });
}

function clean_(value) {
  return String(value == null ? '' : value).trim().slice(0, 500);
}

function hashPassword_(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password || ''), Utilities.Charset.UTF_8);
  return digest.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function requireSession_(token, requiredType) {
  const value = String(token || '');
  const cached = value ? CacheService.getScriptCache().get(SESSION_PREFIX + value) : '';
  if (!cached) throw new Error('Sesi tidak valid atau sudah berakhir. Silakan login kembali.');
  const session = JSON.parse(cached);
  if (requiredType && session.accountType !== requiredType) throw new Error('Akses admin diperlukan.');
  return session;
}

function findUserByNis_(nis) {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.users);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row += 1) {
    if (String(values[row][0] || '').trim() === String(nis || '').trim()) {
      return { nis: String(values[row][0] || ''), name: String(values[row][1] || ''), passwordHash: String(values[row][2] || ''), className: String(values[row][3] || '') };
    }
  }
  return null;
}

function publicUser_(user) {
  return { accountType: user.accountType, username: user.username || '', nis: user.nis || '', name: user.name, className: user.className || '' };
}

function ensureUserHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, USER_HEADERS.length).setValues([USER_HEADERS]);
    return;
  }
  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), USER_HEADERS.length)).getValues()[0].map(String);
  if (USER_HEADERS.every(function(header, index) { return currentHeaders[index] === header; })) return;
  const oldHeaders = currentHeaders.filter(function(header) { return header; });
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, oldHeaders.length).getValues() : [];
  const migratedRows = rows.map(function(row) {
    const oldUser = {};
    oldHeaders.forEach(function(header, index) { oldUser[header] = row[index]; });
    return USER_HEADERS.map(function(header) {
      if (header === 'name') return oldUser.name || '';
      if (header === 'className') return oldUser.className || '';
      if (header === 'createdAt') return oldUser.createdAt || '';
      return '';
    });
  });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, USER_HEADERS.length).setValues([USER_HEADERS]);
  if (migratedRows.length) sheet.getRange(2, 1, migratedRows.length, USER_HEADERS.length).setValues(migratedRows);
}

function ensureReportHeaders_(sheet) {
  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), REPORT_HEADERS.length)).getValues()[0].map(String);
  if (REPORT_HEADERS.every(function(header, index) { return currentHeaders[index] === header; })) return;
  const oldHeaders = currentHeaders.filter(function(header) { return header; });
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, oldHeaders.length).getValues() : [];
  const migratedRows = rows.map(function(row) {
    const oldReport = {};
    oldHeaders.forEach(function(header, index) { oldReport[header] = row[index]; });
    return REPORT_HEADERS.map(function(header) { return oldReport[header] || ''; });
  });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, REPORT_HEADERS.length).setValues([REPORT_HEADERS]);
  if (migratedRows.length) sheet.getRange(2, 1, migratedRows.length, REPORT_HEADERS.length).setValues(migratedRows);
}