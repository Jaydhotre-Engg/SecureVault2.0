import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const BASE_URL = 'http://127.0.0.1:8000/api';

async function runFrontendIntegrationTest() {
  console.log('='.repeat(70));
  console.log('SECUREVAULT 2.0 FRONTEND API INTEGRATION TEST SUITE');
  console.log('='.repeat(70));

  // 1. Test Admin Login
  console.log('\n[1] Testing Admin Login (/auth/login)...');
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    username: 'admin',
    password: 'AdminMasterPass2026!',
  });
  const adminToken = loginRes.data.access_token;
  console.log('  Admin Login: SUCCESS (Token acquired)');

  // 2. Test Get Current User (/auth/me)
  console.log('\n[2] Testing Get Current User Profile (/auth/me)...');
  const meRes = await axios.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`  User Profile: SUCCESS (username=${meRes.data.username}, role=${meRes.data.role}, active=${meRes.data.is_active})`);
  if (meRes.data.role !== 'ADMIN') throw new Error('Role mismatch!');

  // 3. Test Register New Investigator (/auth/register)
  const testInvestigatorUser = `test_fe_inv_${Date.now()}`;
  console.log(`\n[3] Testing Investigator Registration (/auth/register) for '${testInvestigatorUser}'...`);
  const regRes = await axios.post(`${BASE_URL}/auth/register`, {
    username: testInvestigatorUser,
    email: `${testInvestigatorUser}@securevault.local`,
    password: 'InvestigatorPass1!',
  });
  console.log(`  Registration: SUCCESS (User ID=${regRes.data.id}, role=${regRes.data.role})`);

  // 4. Test Investigator Login
  console.log('\n[4] Testing Investigator Login (/auth/login)...');
  const invLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
    username: testInvestigatorUser,
    password: 'InvestigatorPass1!',
  });
  const invToken = invLoginRes.data.access_token;
  console.log('  Investigator Login: SUCCESS');

  // 5. Test Evidence Upload by Investigator (/evidence/upload)
  console.log('\n[5] Testing Evidence Upload with multipart/form-data (/evidence/upload)...');
  const form = new FormData();
  const testPayload = Buffer.from('Forensic Disk Dump Sector 0x9AF012 - Cryptographic Sample');
  form.append('file', testPayload, { filename: 'sector_dump_sample.bin' });

  const uploadRes = await axios.post(`${BASE_URL}/evidence/upload`, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${invToken}`,
    },
  });
  const uploadedEvidence = uploadRes.data.evidence;
  console.log(`  Upload: SUCCESS (ID=${uploadedEvidence.id}, filename=${uploadedEvidence.filename}, sha256=${uploadedEvidence.sha256.substring(0, 16)}..., encrypted=${uploadedEvidence.encrypted})`);

  // 6. Test Evidence Detail (/evidence/{id})
  console.log(`\n[6] Testing Evidence Detail (/evidence/${uploadedEvidence.id})...`);
  const detailRes = await axios.get(`${BASE_URL}/evidence/${uploadedEvidence.id}`, {
    headers: { Authorization: `Bearer ${invToken}` },
  });
  console.log(`  Detail: SUCCESS (filename=${detailRes.data.filename}, status=${detailRes.data.verification_status}, size=${detailRes.data.file_size})`);

  // 7. Test Evidence Verification (/evidence/{id}/verify)
  console.log(`\n[7] Testing Cryptographic Integrity Verification (/evidence/${uploadedEvidence.id}/verify)...`);
  const verifyRes = await axios.post(
    `${BASE_URL}/evidence/${uploadedEvidence.id}/verify`,
    {},
    { headers: { Authorization: `Bearer ${invToken}` } }
  );
  console.log(`  Verification: SUCCESS (status=${verifyRes.data.status}, match=${verifyRes.data.stored_hash === verifyRes.data.current_hash})`);
  if (verifyRes.data.status !== 'VALID') throw new Error('Verification failed!');

  // 8. Test Evidence List (/evidence)
  console.log('\n[8] Testing Evidence Repository List (/evidence)...');
  const listRes = await axios.get(`${BASE_URL}/evidence`, {
    headers: { Authorization: `Bearer ${invToken}` },
  });
  console.log(`  Evidence List: SUCCESS (Found ${listRes.data.length} records accessible to investigator)`);

  // 9. Test Admin Users List (/users)
  console.log('\n[9] Testing Admin User Directory (/users)...');
  const usersRes = await axios.get(`${BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`  Users List: SUCCESS (Found ${usersRes.data.length} users in directory)`);

  // 10. Test Admin Deactivate User (/users/{id}/deactivate)
  console.log(`\n[10] Testing Admin Deactivate User (/users/${regRes.data.id}/deactivate)...`);
  const deactRes = await axios.patch(
    `${BASE_URL}/users/${regRes.data.id}/deactivate`,
    {},
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  console.log(`  Deactivation: SUCCESS (is_active=${deactRes.data.is_active})`);

  // 11. Test Admin Reactivate User (/users/{id}/reactivate)
  console.log(`\n[11] Testing Admin Reactivate User (/users/${regRes.data.id}/reactivate)...`);
  const reactRes = await axios.patch(
    `${BASE_URL}/users/${regRes.data.id}/reactivate`,
    {},
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  console.log(`  Reactivation: SUCCESS (is_active=${reactRes.data.is_active})`);

  // 12. Test Audit Logs (/users/audit-logs)
  console.log('\n[12] Testing Forensic Audit Trail (/users/audit-logs)...');
  const auditRes = await axios.get(`${BASE_URL}/users/audit-logs?limit=50`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`  Audit Logs: SUCCESS (Retrieved ${auditRes.data.length} audit trail records)`);

  // Verify non-leakage in audit details
  for (const log of auditRes.data) {
    if (log.detail && (log.detail.includes('InvestigatorPass') || log.detail.includes('$2b$'))) {
      throw new Error('Credential leak detected in audit logs!');
    }
  }
  console.log('  Audit Logs Sanitization: PASS (Zero passwords/hashes found)');

  console.log('\n' + '='.repeat(70));
  console.log('ALL FRONTEND API INTEGRATION ENDPOINTS VERIFIED 100% OPERATIONAL');
  console.log('='.repeat(70));
}

runFrontendIntegrationTest().catch((err) => {
  console.error('Integration test error:', err.response?.data || err.message);
  process.exit(1);
});
