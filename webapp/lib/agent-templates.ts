export interface AgentTemplate {
  id:          string;
  name:        string;
  description: string;
  icon:        string;        // emoji
  tools:       string[];
  memoryProvider: string;
  maxDepth:    number;
  promptHint: string;         // shown to user as a usage hint
}

const TEMPLATES: AgentTemplate[] = [
  {
    id:          'dependency-auditor',
    name:        'Dependency Auditor',
    description: 'Scans package.json / requirements.txt for known CVEs and outdated packages. Run on a schedule or on push.',
    icon:        '📦',
    tools:       ['read_file', 'list_files', 'terminal', 'web_search'],
    memoryProvider: 'builtin',
    maxDepth:    1,
    promptHint:  'Trigger with: "Audit all dependencies in this repo for known vulnerabilities."',
  },
  {
    id:          'secrets-scanner',
    name:        'Secrets Scanner',
    description: 'Searches the codebase for accidentally committed secrets — API keys, tokens, credentials, and private keys.',
    icon:        '🔑',
    tools:       ['read_file', 'list_files', 'grep_codebase'],
    memoryProvider: 'builtin',
    maxDepth:    1,
    promptHint:  'Trigger with: "Scan the entire codebase for exposed secrets and credentials."',
  },
  {
    id:          'sast-reviewer',
    name:        'SAST Code Reviewer',
    description: 'Static analysis agent that reviews code for injection, XSS, SSRF, insecure deserialization, and OWASP Top 10.',
    icon:        '🔬',
    tools:       ['read_file', 'list_files', 'grep_codebase', 'web_search'],
    memoryProvider: 'builtin',
    maxDepth:    2,
    promptHint:  'Trigger with: "Review this codebase for OWASP Top 10 vulnerabilities."',
  },
  {
    id:          'container-scanner',
    name:        'Container Security Scanner',
    description: 'Audits Dockerfiles and container configs for privileged mode, root users, exposed ports, and unsafe base images.',
    icon:        '🐳',
    tools:       ['read_file', 'list_files', 'terminal'],
    memoryProvider: 'builtin',
    maxDepth:    1,
    promptHint:  'Trigger with: "Scan all Dockerfiles and docker-compose files for security misconfigurations."',
  },
  {
    id:          'api-security',
    name:        'API Security Tester',
    description: 'Tests REST API endpoints for broken authentication, missing rate limits, excessive data exposure, and IDOR.',
    icon:        '🌐',
    tools:       ['read_file', 'list_files', 'terminal', 'web_search', 'browser'],
    memoryProvider: 'builtin',
    maxDepth:    2,
    promptHint:  'Trigger with: "Test the API endpoints in this repo for common security vulnerabilities."',
  },
  {
    id:          'compliance-checker',
    name:        'Compliance Checker',
    description: 'Checks your codebase and infra configs against SOC 2, GDPR, and CIS benchmarks. Produces a findings report.',
    icon:        '📋',
    tools:       ['read_file', 'list_files', 'grep_codebase', 'web_search'],
    memoryProvider: 'builtin',
    maxDepth:    2,
    promptHint:  'Trigger with: "Check this codebase for SOC 2 / GDPR compliance gaps."',
  },
];

export default TEMPLATES;
