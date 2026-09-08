const SHEET_NAMES = {
  reports: 'Laporan',
  users: 'Pengguna'
};

const PHOTO_FOLDER_PROPERTY = 'PHOTO_FOLDER_ID';
const TEMP_ACCESS_PIN = '7392';
const ACCESS_ROLES = ['Guru', 'Admin', 'Siswa'];
const PUBLIC_STATUS_LABELS = {
  open: 'Belum diambil',
  done: 'Sudah diambil'
};

const REPORT_HEADERS = [
  'id', 'createdAt', 'updatedAt', 'type', 'title', 'description',
  'location', 'dateFoundOrLost', 'reporterName', 'reporterClass',
  'reporterRole', 'contact', 'status', 'photoUrl', 'claimedBy', 'notes'
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
  getOrCreateSheet_(spreadsheet, SHEET_NAMES.users, ['name', 'className', 'role', 'contact', 'createdAt']);
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());
  reportsSheet.setFrozenRows(1);
  return { spreadsheetUrl: spreadsheet.getUrl(), message: 'Database siap digunakan.' };
}

function getAppData(filters) {
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

function saveReport(payload) {
  setupApp();
  validateReport_(payload);
  validateAccess_(payload.accessRole, payload.type, 'create', payload.accessPin);
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
    reporterName: clean_(payload.reporterName),
    reporterClass: clean_(payload.reporterClass),
    reporterRole: cleanRole_(payload.reporterRole || payload.accessRole),
    contact: clean_(payload.contact),
    status: 'Dilaporkan',
    photoUrl: photoUrl,
    claimedBy: '',
    notes: ''
  };
  appendRow_(SHEET_NAMES.reports, report);
  return { message: 'Laporan berhasil dikirim.', report: report };
}

function updateReport(id, payload) {
  setupApp();
  validateReport_(payload);
  validateAccess_(payload.accessRole, payload.type, 'edit', payload.accessPin);
  const sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.reports);
  const values = sheet.getDataRange().getValues();
  const idColumn = REPORT_HEADERS.indexOf('id');
  for (let row = 1; row < values.length; row += 1) {
    if (String(values[row][idColumn]) === String(id)) {
      const report = rowToReport_(values[row]);
      report.updatedAt = new Date().toISOString();
      report.type = payload.type;
      report.title = clean_(payload.title);
      report.description = clean_(payload.description);
      report.location = clean_(payload.location);
      report.dateFoundOrLost = clean_(payload.dateFoundOrLost);
      report.reporterName = clean_(payload.reporterName);
      report.reporterClass = clean_(payload.reporterClass);
      report.reporterRole = cleanRole_(payload.reporterRole || payload.accessRole);
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

function updateReportStatus(id, status, actorName, note, actorRole) {
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
      validateAccess_(actorRole, report.type, 'status', arguments[5]);
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

function verifyAccess(role, accessPin) {
  if (['Guru', 'Admin'].indexOf(role) !== -1) validatePin_(accessPin);
  else if (role !== 'Siswa') throw new Error('Peran akses tidak valid.');
  return { valid: true };
}

function deleteReport(id, actorRole, accessPin) {
  setupApp();
  const sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.reports);
  const values = sheet.getDataRange().getValues();
  const idColumn = REPORT_HEADERS.indexOf('id');
  for (let row = 1; row < values.length; row += 1) {
    if (String(values[row][idColumn]) === String(id)) {
      const report = rowToReport_(values[row]);
      validateAccess_(actorRole, report.type, 'delete', accessPin);
      trashPhoto_(report.photoUrl);
      sheet.deleteRow(row + 1);
      return { message: 'Laporan berhasil dihapus.' };
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
  ['title', 'description', 'location', 'dateFoundOrLost', 'reporterName', 'reporterClass', 'contact']
    .forEach(function(field) {
      if (!clean_(payload[field])) throw new Error('Kolom ' + field + ' wajib diisi.');
    });
}

function validateAccess_(role, reportType, action, accessPin) {
  if (ACCESS_ROLES.indexOf(role) === -1) throw new Error('Peran akses tidak valid.');
  if (action === 'create' && role === 'Siswa' && reportType !== 'Hilang') {
    throw new Error('Siswa hanya dapat membuat laporan barang hilang.');
  }
  if (['Guru', 'Admin'].indexOf(role) !== -1) validatePin_(accessPin);
  if (['edit', 'delete', 'status'].indexOf(action) !== -1 && role === 'Siswa') {
    throw new Error('Siswa tidak dapat mengubah laporan.');
  }
}

function cleanRole_(role) {
  return ACCESS_ROLES.indexOf(role) === -1 ? 'Siswa' : role;
}

function validatePin_(accessPin) {
  if (String(accessPin || '') !== TEMP_ACCESS_PIN) throw new Error('PIN Guru/Admin salah.');
}

function trashPhoto_(photoUrl) {
  const match = String(photoUrl || '').match(/[?&]id=([^&]+)/) || String(photoUrl || '').match(/\/d\/([^/]+)/);
  if (!match) return;
  try {
    DriveApp.getFileById(decodeURIComponent(match[1])).setTrashed(true);
  } catch (error) {
    // Laporan tetap dapat dihapus meskipun foto sudah tidak tersedia.
  }
}

function clean_(value) {
  return String(value == null ? '' : value).trim().slice(0, 500);
}