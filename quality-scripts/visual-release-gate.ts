import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.env.VISUAL_EVIDENCE_DIR || 'e2e/visual-evidence');
const runId = process.env.GITHUB_RUN_ID || 'local';
const commitSha = process.env.GITHUB_SHA || 'local';
const workflow = process.env.GITHUB_WORKFLOW || 'local';
const ref = process.env.GITHUB_REF_NAME || 'local';
const manifestPath = path.join(ROOT, 'visual-manifest.json');

const responsiveProjects = ['desktop-1280','laptop-1440','desktop-1920','tablet-768','tablet-820','mobile-390','mobile-412','mobile-safari'];
const roleProjects = ['role-1280','role-desktop','role-1920','role-tablet-768','role-tablet-820','role-mobile','role-mobile-412','role-mobile-safari'];
const roles = ['owner','admin','doctor','assistant','manager','regular','patient','diagnostic-owner','diagnostic-operator','medical-lab-owner','medical-lab-tech','dental-lab-owner','dental-technician','superadmin','support','laboratory'];
const visualAgentViewports = ['desktop-1440','tablet-820','mobile-390'];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(p) : [p];
  });
}

function validPng(p: string): boolean {
  const b = fs.readFileSync(p);
  return b.length > 24 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
}

function requireFile(p: string, label: string) {
  if (!fs.existsSync(p)) throw new Error(`Missing ${label}: ${path.relative(process.cwd(), p)}`);
  if (!validPng(p)) throw new Error(`Invalid/non-PNG visual evidence: ${path.relative(process.cwd(), p)}`);
}

if (!fs.existsSync(ROOT)) throw new Error(`Visual evidence directory does not exist: ${ROOT}`);
const files = walk(ROOT).filter((p) => p.toLowerCase().endsWith('.png'));
if (files.length === 0) throw new Error('Visual release gate produced zero screenshots.');

const responsiveFiles = files.filter((p) => p.includes(`${path.sep}responsive${path.sep}`));
const roleFiles = files.filter((p) => p.includes(`${path.sep}roles${path.sep}`));
const visualAgentFiles = files.filter((p) => p.includes(`${path.sep}visual-agent${path.sep}`));

for (const project of responsiveProjects) {
  const projectFiles = responsiveFiles.filter((p) => path.basename(p).startsWith(project));
  if (projectFiles.length < 13) throw new Error(`Responsive visual evidence incomplete for ${project}: expected at least 13 screenshots, found ${projectFiles.length}`);
}
for (const role of roles) {
  for (const project of roleProjects) requireFile(path.join(ROOT, 'roles', role, `${project}.png`), `${role}/${project}`);
  for (const viewport of visualAgentViewports) {
    const agentDir = path.join(ROOT, 'visual-agent', role, viewport);
    const agentScreens = walk(agentDir).filter((p) => p.toLowerCase().endsWith('.png'));
    if (agentScreens.length < 4) throw new Error(`Visual Agent evidence incomplete for ${role}/${viewport}: expected at least 4 screenshots, found ${agentScreens.length}`);
    const runtime = path.join(agentDir, 'runtime.json');
    if (!fs.existsSync(runtime)) throw new Error(`Visual Agent runtime evidence missing: ${path.relative(process.cwd(), runtime)}`);
  }
}

const entries = files.map((file) => ({
  path: path.relative(ROOT, file).replaceAll(path.sep, '/'),
  bytes: fs.statSync(file).size,
})).sort((a,b) => a.path.localeCompare(b.path));

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  run: { runId, commitSha, workflow, ref, evidenceRoot: path.relative(process.cwd(), ROOT) },
  policy: { responsiveProjects, roleProjects, roles, visualAgentViewports, minimumResponsiveScreenshots: 13, minimumRoleScreenshots: roles.length * roleProjects.length, minimumVisualAgentScreenshotsPerRoleViewport: 4 },
  totals: { screenshots: entries.length, responsive: responsiveFiles.length, roles: roleFiles.length, visualAgent: visualAgentFiles.length },
  screenshots: entries,
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest.totals));