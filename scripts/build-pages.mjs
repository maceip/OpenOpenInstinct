/* oxlint-disable eslint/no-restricted-properties -- Static GitHub Pages generator. */
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(rootDirectory, "out_pages");

export function buildPages(targetDir = outputDirectory) {
  mkdirSync(targetDir, { recursive: true });
  mkdirSync(join(targetDir, "assets"), { recursive: true });

  // Create .nojekyll so GitHub Pages does not ignore underscore or standard web assets
  writeFileSync(join(targetDir, ".nojekyll"), "");

  // Copy logo if exists
  const logoSource = join(rootDirectory, ".github", "logo.jpg");
  if (existsSync(logoSource)) {
    copyFileSync(logoSource, join(targetDir, "assets", "logo.jpg"));
  }

  const html = generateIndexHtml();
  writeFileSync(join(targetDir, "index.html"), html, "utf8");

  console.log(`GitHub Pages static site generated at ${targetDir}`);
}

function generateIndexHtml() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenOpenInstinct — Self-Hosted Personal Agent with Browser Execution & Local Vault</title>
  <meta name="description" content="A self-hosted personal agent for iMessage and the web that can use a browser like you. Zero serverless DB, local SQLite with WAL, and WebCrypto P-256 device authentication.">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f4f4f5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 2L2 7l10 5 10-5-10-5z'/%3E%3Cpath d='M2 17l10 5 10-5'/%3E%3Cpath d='M2 12l10 5 10-5'/%3E%3C/svg%3E">
  <style>
    :root {
      --background: #09090b;
      --foreground: #fafafa;
      --card: #121215;
      --card-foreground: #fafafa;
      --popover: #121215;
      --popover-foreground: #fafafa;
      --primary: #f4f4f5;
      --primary-foreground: #18181b;
      --secondary: #27272a;
      --secondary-foreground: #fafafa;
      --muted: #27272a;
      --muted-foreground: #a1a1aa;
      --accent: #27272a;
      --accent-foreground: #fafafa;
      --destructive: #ef4444;
      --destructive-foreground: #fafafa;
      --success: #22c55e;
      --success-foreground: #fafafa;
      --warning: #f59e0b;
      --info: #3b82f6;
      --border: #27272a;
      --input: #27272a;
      --ring: #71717a;
      --radius: 0.625rem;
      --sidebar: #0e0e11;
      --sidebar-border: #1f1f23;
      --sidebar-foreground: #fafafa;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    html.light {
      --background: #ffffff;
      --foreground: #09090b;
      --card: #f9f9fb;
      --card-foreground: #09090b;
      --popover: #ffffff;
      --popover-foreground: #09090b;
      --primary: #18181b;
      --primary-foreground: #f4f4f5;
      --secondary: #f4f4f5;
      --secondary-foreground: #18181b;
      --muted: #f4f4f5;
      --muted-foreground: #71717a;
      --accent: #f4f4f5;
      --accent-foreground: #18181b;
      --destructive: #dc2626;
      --destructive-foreground: #ffffff;
      --success: #16a34a;
      --success-foreground: #ffffff;
      --warning: #d97706;
      --info: #2563eb;
      --border: #e4e4e7;
      --input: #e4e4e7;
      --ring: #a1a1aa;
      --sidebar: #f4f4f6;
      --sidebar-border: #e4e4e7;
      --sidebar-foreground: #09090b;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      border-color: var(--border);
    }

    body {
      font-family: var(--font-sans);
      background-color: var(--background);
      color: var(--foreground);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* Typography Classes matching app styles */
    .type-product-title { font-size: 2rem; font-weight: 700; letter-spacing: -0.025em; line-height: 1.15; }
    .type-page-title { font-size: 1.5rem; font-weight: 600; letter-spacing: -0.02em; line-height: 1.25; }
    .type-section-title { font-size: 1.125rem; font-weight: 600; letter-spacing: -0.01em; line-height: 1.35; }
    .type-card-title { font-size: 0.9375rem; font-weight: 600; line-height: 1.35; }
    .type-body { font-size: 0.9375rem; line-height: 1.5; }
    .type-supporting-body { font-size: 0.875rem; line-height: 1.45; }
    .type-caption { font-size: 0.75rem; line-height: 1.35; }
    .type-label { font-size: 0.8125rem; font-weight: 500; }
    .type-code { font-family: var(--font-mono); font-size: 0.8125rem; }
    .type-mono { font-family: var(--font-mono); }

    /* Layout */
    .app-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    @media (min-width: 768px) {
      .app-container {
        flex-direction: row;
      }
    }

    /* Sidebar */
    .sidebar {
      width: 100%;
      background: var(--sidebar);
      border-bottom: 1px solid var(--sidebar-border);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    @media (min-width: 768px) {
      .sidebar {
        width: 16rem;
        min-width: 16rem;
        border-bottom: none;
        border-right: 1px solid var(--sidebar-border);
        padding: 1.5rem 1rem;
        height: 100vh;
        position: sticky;
        top: 0;
      }
    }

    .brand-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo-icon {
      width: 2rem;
      height: 2rem;
      flex-shrink: 0;
    }

    .brand-title {
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: -0.02em;
    }

    .brand-badge {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      padding: 0.15rem 0.4rem;
      border-radius: 9999px;
      background: var(--secondary);
      color: var(--muted-foreground);
      border: 1px solid var(--border);
    }

    .nav-menu {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
    }

    .nav-button {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.75rem;
      border-radius: var(--radius);
      border: 1px solid transparent;
      background: transparent;
      color: var(--muted-foreground);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: all 0.15s ease;
      width: 100%;
    }

    .nav-button:hover {
      background: var(--secondary);
      color: var(--foreground);
    }

    .nav-button.active {
      background: var(--secondary);
      color: var(--foreground);
      border-color: var(--border);
      font-weight: 600;
    }

    .nav-button svg {
      width: 1.125rem;
      height: 1.125rem;
      shrink: 0;
    }

    /* Main Content Area */
    .main-content {
      flex: 1;
      padding: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
    }

    @media (min-width: 768px) {
      .main-content {
        padding: 2.5rem;
      }
    }

    /* Tab Panels */
    .tab-panel {
      display: none;
      flex-direction: column;
      gap: 2rem;
    }

    .tab-panel.active {
      display: flex;
    }

    /* Cards & Panels */
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.25rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      border: 1px solid var(--border);
    }

    .badge-success { background: rgba(34, 197, 94, 0.1); color: var(--success); border-color: rgba(34, 197, 94, 0.2); }
    .badge-info { background: rgba(59, 130, 246, 0.1); color: var(--info); border-color: rgba(59, 130, 246, 0.2); }
    .badge-warning { background: rgba(245, 158, 11, 0.1); color: var(--warning); border-color: rgba(245, 158, 11, 0.2); }

    .pulse-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      background: currentColor;
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.55rem 1rem;
      border-radius: var(--radius);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      border: 1px solid transparent;
      text-decoration: none;
    }

    .btn-primary {
      background: var(--primary);
      color: var(--primary-foreground);
    }
    .btn-primary:hover {
      opacity: 0.9;
    }

    .btn-outline {
      background: transparent;
      border-color: var(--border);
      color: var(--foreground);
    }
    .btn-outline:hover {
      background: var(--secondary);
    }

    .btn-sm {
      padding: 0.35rem 0.65rem;
      font-size: 0.8125rem;
    }

    /* Forms */
    .input-field, .textarea-field, .select-field {
      width: 100%;
      padding: 0.55rem 0.75rem;
      border-radius: var(--radius);
      border: 1px solid var(--input);
      background: var(--background);
      color: var(--foreground);
      font-size: 0.875rem;
      outline: none;
      transition: border-color 0.15s;
    }

    .input-field:focus, .textarea-field:focus, .select-field:focus {
      border-color: var(--ring);
    }

    /* Grid layouts */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    @media (min-width: 640px) {
      .grid-2 { grid-template-columns: repeat(2, 1fr); }
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    @media (min-width: 768px) {
      .grid-3 { grid-template-columns: repeat(3, 1fr); }
    }

    /* Code block */
    .code-block {
      background: #0d0d10;
      color: #e4e4e7;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1rem;
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      overflow-x: auto;
      line-height: 1.6;
    }

    /* Flow diagram */
    .diagram-container {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.5rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 1rem;
    }

    .diagram-step {
      background: var(--secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 0.75rem 1rem;
      text-align: center;
      min-width: 140px;
    }

    .diagram-arrow {
      color: var(--muted-foreground);
      font-weight: bold;
    }

    /* Table */
    .table-container {
      width: 100%;
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }

    th {
      background: var(--secondary);
      padding: 0.75rem 1rem;
      font-weight: 600;
      border-bottom: 1px solid var(--border);
      color: var(--foreground);
    }

    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
      color: var(--muted-foreground);
    }

    tr:last-child td {
      border-bottom: none;
    }

    /* Chat Messages */
    .chat-window {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      display: flex;
      flex-direction: column;
      height: 480px;
    }

    .chat-messages {
      flex: 1;
      padding: 1.25rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .chat-bubble {
      max-width: 80%;
      padding: 0.75rem 1rem;
      border-radius: 1rem;
      font-size: 0.875rem;
      line-height: 1.45;
    }

    .chat-bubble-user {
      align-self: flex-end;
      background: var(--primary);
      color: var(--primary-foreground);
      border-bottom-right-radius: 0.25rem;
    }

    .chat-bubble-agent {
      align-self: flex-start;
      background: var(--secondary);
      color: var(--foreground);
      border-bottom-left-radius: 0.25rem;
      border: 1px solid var(--border);
    }

    .trace-card {
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 0.6rem 0.75rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--muted-foreground);
      margin-top: 0.5rem;
    }

    /* Footer */
    footer {
      border-top: 1px solid var(--border);
      padding: 2rem 1.5rem;
      text-align: center;
      color: var(--muted-foreground);
      font-size: 0.8125rem;
      margin-top: auto;
    }
  </style>
</head>
<body>
  <div class="app-container">
    <!-- Sidebar Navigation -->
    <aside class="sidebar">
      <div class="brand-header">
        <svg class="logo-icon" viewBox="-118.955 0 1500.07 1500.07" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon fill="var(--primary)" fill-opacity="0.82" points="329.93 573.62 329.93 928.72 631.08 1108.55 631.08 751.17 329.93 573.62"/>
          <polygon fill="var(--primary)" points="631.08 393.8 631.08 393.8 329.93 573.62 631.08 751.17 930.02 573.62 631.08 393.8"/>
          <polygon fill="var(--primary)" fill-opacity="0.64" points="930.02 573.62 631.08 751.17 631.08 1108.55 631.08 1108.55 930.02 928.72 930.02 573.62"/>
          <path d="M631.08,0L0,375.59v748.9l631.08,375.59,631.08-375.59V375.59L631.08,0ZM1244.38,1119.95l-23.37-13.87-583.28,346.79v24.44h-13.29v-24.44L42.19,1106.7l-18.14,10.76-6.64-11.83,20.24-12.01V402.02l-19.13-11.35,6.64-11.83,24.58,14.59L624.44,51.75v-26.71h13.29v26.71l577.08,343.1,25.16-14.93,6.64,11.83-22.08,13.1v687.54l26.5,15.73-6.64,11.83Z" fill="var(--foreground)"/>
        </svg>
        <div>
          <div class="brand-title">OpenOpenInstinct</div>
          <div class="type-caption text-muted-foreground">Self-Hosted Personal Agent</div>
        </div>
      </div>

      <nav class="nav-menu">
        <button class="nav-button active" onclick="switchTab('workspace')">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          Workspace
        </button>
        <button class="nav-button" onclick="switchTab('vault')">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m21 2-2 2m-6 6 7.5-7.5M15.5 8.5l3 3M18.5 5.5l3 3M2 15.5A3.5 3.5 0 0 0 5.5 19H6v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2h1a3.5 3.5 0 0 0 3.5-3.5V15a3.5 3.5 0 0 0-3.5-3.5H5.5A3.5 3.5 0 0 0 2 15.5Z"/></svg>
          Vault & Secrets
        </button>
        <button class="nav-button" onclick="switchTab('tasks')">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          Browser Jobs
        </button>
        <button class="nav-button" onclick="switchTab('chat')">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Agent Chat
        </button>
        <button class="nav-button" onclick="switchTab('device-auth')">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
          Device Auth
        </button>
        <button class="nav-button" onclick="switchTab('deploy')">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M12 12v9M8 17l4 4 4-4"/></svg>
          Self-Host Guide
        </button>
      </nav>

      <div style="display: flex; gap: 0.5rem; align-items: center; justify-content: space-between; padding-top: 1rem; border-top: 1px solid var(--sidebar-border);">
        <button class="btn btn-outline btn-sm" onclick="toggleTheme()" id="theme-btn">
          🌙 Dark
        </button>
        <a class="btn btn-outline btn-sm" href="https://github.com/maceip/OpenOpenInstinct" target="_blank" rel="noopener">
          GitHub ↗
        </a>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- WORKSPACE TAB -->
      <section id="tab-workspace" class="tab-panel active">
        <header>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div>
              <h1 class="type-product-title">Workspace</h1>
              <p class="type-supporting-body" style="color: var(--muted-foreground); margin-top: 0.25rem;">
                A personal iMessage and web assistant powered by Eve, Kernel, and local SQLite.
              </p>
            </div>
            <span class="badge badge-success">
              <span class="pulse-dot"></span>
              Local Node Active
            </span>
          </div>
        </header>

        <!-- Status Highlights -->
        <div class="grid-3">
          <div class="card">
            <div class="type-caption" style="color: var(--muted-foreground);">STORAGE ENGINE</div>
            <div class="type-card-title" style="margin-top: 0.25rem;">Local SQLite + WAL</div>
            <div class="type-caption" style="color: var(--success); margin-top: 0.5rem;">● Strict tables · No cloud DB required</div>
          </div>
          <div class="card">
            <div class="type-caption" style="color: var(--muted-foreground);">BROWSER PLATFORM</div>
            <div class="type-card-title" style="margin-top: 0.25rem;">Kernel Cloud Browser</div>
            <div class="type-caption" style="color: var(--info); margin-top: 0.5rem;">● Isolated Chromium + Stealth Anti-Bot</div>
          </div>
          <div class="card">
            <div class="type-caption" style="color: var(--muted-foreground);">AUTHENTICATION</div>
            <div class="type-card-title" style="margin-top: 0.25rem;">P-256 WebCrypto Keys</div>
            <div class="type-caption" style="color: var(--success); margin-top: 0.5rem;">● One-use URL fragment pairing</div>
          </div>
        </div>

        <!-- Channels Section -->
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="type-section-title">Communication Channels</h2>
              <p class="type-supporting-body" style="color: var(--muted-foreground);">Connected endpoints for conversational tasks</p>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--secondary); border-radius: var(--radius);">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <div>
                  <div class="type-label">Web Chat Interface</div>
                  <div class="type-caption" style="color: var(--muted-foreground);">Interactive web chat session with streaming responses</div>
                </div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="switchTab('chat')">Open Chat →</button>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--secondary); border-radius: var(--radius);">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <div>
                  <div class="type-label">iMessage via Linq</div>
                  <div class="type-caption" style="color: var(--muted-foreground);">Two-way native iMessage relay with webhook secret validation</div>
                </div>
              </div>
              <span class="badge badge-success">Configured</span>
            </div>
          </div>
        </div>

        <!-- Infrastructure Section -->
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="type-section-title">Infrastructure Connectors</h2>
              <p class="type-supporting-body" style="color: var(--muted-foreground);">Local and upstream service integrations</p>
            </div>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Implementation</th>
                  <th>Security Policy</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight: 500; color: var(--foreground);">Kernel Browser</td>
                  <td>Remote Sandboxed Chromium (v0.96.0 SDK)</td>
                  <td>Zero local process footprint · Isolated ephemeral containers</td>
                  <td><span class="badge badge-success">Ready</span></td>
                </tr>
                <tr>
                  <td style="font-weight: 500; color: var(--foreground);">Database</td>
                  <td>SQLite with WAL + strict schemas</td>
                  <td>Loopback only · File mode 0600 · Automatic WAL checkpointing</td>
                  <td><span class="badge badge-success">Mounted</span></td>
                </tr>
                <tr>
                  <td style="font-weight: 500; color: var(--foreground);">Encrypted Vault</td>
                  <td>AES-256-GCM authenticated encryption</td>
                  <td>Secrets filled directly into DOM · Zero LLM exposure</td>
                  <td><span class="badge badge-success">Encrypted</span></td>
                </tr>
                <tr>
                  <td style="font-weight: 500; color: var(--foreground);">AI Model Provider</td>
                  <td>OpenAI / Anthropic / Google / Ollama</td>
                  <td>Direct provider API key · No intermediate proxies</td>
                  <td><span class="badge badge-info">Direct</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- VAULT TAB -->
      <section id="tab-vault" class="tab-panel">
        <header>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div>
              <h1 class="type-product-title">Encrypted Vault</h1>
              <p class="type-supporting-body" style="color: var(--muted-foreground); margin-top: 0.25rem;">
                Private credentials and payment cards filled directly into approved browser forms.
              </p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="alert('Item creation demo: In your self-hosted instance, vault items are encrypted with AES-256-GCM using your VAULT_ENCRYPTION_KEY.')">
              + New Vault Item
            </button>
          </div>
        </header>

        <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: var(--radius); padding: 1rem; display: flex; gap: 0.75rem; align-items: flex-start;">
          <svg width="20" height="20" fill="none" stroke="var(--info)" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink: 0; margin-top: 0.1rem;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <div class="type-supporting-body">
            <strong>Zero Model Leakage Policy:</strong> Vault items are stored encrypted in SQLite with random 96-bit nonces. When executing tasks, the server decrypts values and injects them straight into target input fields inside the Kernel browser session. Raw secrets are never returned in agent completions.
          </div>
        </div>

        <div class="grid-2">
          <!-- Card 1 -->
          <div class="card">
            <div class="card-header">
              <span class="badge badge-info">Payment Card</span>
              <span class="type-caption" style="color: var(--muted-foreground);">ID: vault-card-4242</span>
            </div>
            <div class="type-card-title">Personal Visa Debit</div>
            <div class="type-code" style="margin-top: 0.5rem; color: var(--foreground); letter-spacing: 0.1em;">
              •••• •••• •••• 4242
            </div>
            <div style="margin-top: 0.75rem; display: flex; gap: 1.5rem; font-size: 0.8125rem; color: var(--muted-foreground);">
              <div>Exp: <strong style="color: var(--foreground);">12/28</strong></div>
              <div>CVC: <strong style="color: var(--foreground);">•••</strong></div>
              <div>Zip: <strong style="color: var(--foreground);">94107</strong></div>
            </div>
            <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <span class="type-caption" style="color: var(--success);">✓ Autofill Ready</span>
              <button class="btn btn-outline btn-sm" onclick="simulateAutofill('Visa •••• 4242')">Test Autofill</button>
            </div>
          </div>

          <!-- Card 2 -->
          <div class="card">
            <div class="card-header">
              <span class="badge badge-info">Account Login</span>
              <span class="type-caption" style="color: var(--muted-foreground);">ID: vault-login-amc</span>
            </div>
            <div class="type-card-title">AMC Theatres & Stubs</div>
            <div class="type-supporting-body" style="margin-top: 0.5rem;">
              User: <strong style="color: var(--foreground);">alex@example.com</strong>
            </div>
            <div class="type-supporting-body" style="margin-top: 0.25rem;">
              Pass: <strong style="color: var(--foreground);">••••••••••••••••</strong>
            </div>
            <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <span class="type-caption" style="color: var(--success);">✓ Domain: amctheatres.com</span>
              <button class="btn btn-outline btn-sm" onclick="simulateAutofill('AMC Login')">Test Autofill</button>
            </div>
          </div>
        </div>

        <!-- Encryption Mechanics Diagram -->
        <div class="card">
          <div class="card-header">
            <h2 class="type-section-title">Cryptographic Isolation Flow</h2>
          </div>
          <div class="diagram-container">
            <div class="diagram-step">
              <div class="type-label">Local User Input</div>
              <div class="type-caption" style="color: var(--muted-foreground);">Secret in memory</div>
            </div>
            <div class="diagram-arrow">➔</div>
            <div class="diagram-step">
              <div class="type-label">AES-256-GCM</div>
              <div class="type-caption" style="color: var(--muted-foreground);">96-bit random IV + AAD</div>
            </div>
            <div class="diagram-arrow">➔</div>
            <div class="diagram-step">
              <div class="type-label">SQLite .data</div>
              <div class="type-caption" style="color: var(--muted-foreground);">Encrypted payload + tag</div>
            </div>
            <div class="diagram-arrow">➔</div>
            <div class="diagram-step">
              <div class="type-label">Kernel Browser DOM</div>
              <div class="type-caption" style="color: var(--muted-foreground);">Direct fill via CDP</div>
            </div>
          </div>
        </div>
      </section>

      <!-- TASKS / BATCH RUNNER TAB -->
      <section id="tab-tasks" class="tab-panel">
        <header>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div>
              <h1 class="type-product-title">Browser Jobs & Batch Runner</h1>
              <p class="type-supporting-body" style="color: var(--muted-foreground); margin-top: 0.25rem;">
                Execute multi-step browser tasks concurrently with automated error recovery.
              </p>
            </div>
          </div>
        </header>

        <div class="card">
          <div class="card-header">
            <h2 class="type-section-title">Configure New Batch</h2>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div>
              <label class="type-label" for="batch-name">Batch Name</label>
              <input id="batch-name" class="input-field" style="margin-top: 0.35rem;" value="Movie & Travel Reservations Regression">
            </div>

            <div class="grid-2">
              <div>
                <label class="type-label" for="batch-concurrency">Concurrency Limit</label>
                <select id="batch-concurrency" class="select-field" style="margin-top: 0.35rem;">
                  <option value="1">1 browser worker</option>
                  <option value="2">2 browser workers</option>
                  <option value="4" selected>4 browser workers (Recommended)</option>
                  <option value="8">8 browser workers</option>
                </select>
              </div>
              <div>
                <label class="type-label">Preset Templates</label>
                <select class="select-field" style="margin-top: 0.35rem;" onchange="applyTaskPreset(this.value)">
                  <option value="default">Default: Movie tickets + Flights + Dinner</option>
                  <option value="tickets">Tickets: AMC Metreon + Fandango</option>
                  <option value="travel">Travel: SFO to JFK + Hotel search</option>
                </select>
              </div>
            </div>

            <div>
              <label class="type-label" for="task-prompts">Task List (one task per line)</label>
              <textarea id="task-prompts" class="textarea-field type-code" rows="5" style="margin-top: 0.35rem;">Buy 2 tickets to Spider-Man tonight at AMC Metreon (center seats)
Compare flight prices from SFO to JFK next Tuesday on Google Flights
Book a table for 2 at Benu for Friday at 7:30 PM on Resy</textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
              <button class="btn btn-outline" onclick="document.getElementById('task-prompts').value=''">Clear</button>
              <button class="btn btn-primary" onclick="startBatchSimulation()">
                ▶ Run Batch Simulation
              </button>
            </div>
          </div>
        </div>

        <!-- Simulation Progress Output -->
        <div id="batch-progress-card" class="card" style="display: none;">
          <div class="card-header">
            <div>
              <h3 class="type-card-title">Live Execution Dashboard</h3>
              <p class="type-caption" style="color: var(--muted-foreground);" id="batch-status-text">Processing 3 tasks...</p>
            </div>
            <span class="badge badge-info" id="batch-badge">Running</span>
          </div>

          <div id="batch-workers-container" style="display: flex; flex-direction: column; gap: 1rem;">
            <!-- Rendered dynamically by JS -->
          </div>
        </div>
      </section>

      <!-- AGENT CHAT TAB -->
      <section id="tab-chat" class="tab-panel">
        <header>
          <h1 class="type-product-title">Agent Chat Simulator</h1>
          <p class="type-supporting-body" style="color: var(--muted-foreground); margin-top: 0.25rem;">
            Test the live conversational browser execution flow and native message delivery.
          </p>
        </header>

        <div class="chat-window">
          <div class="chat-messages" id="chat-messages">
            <div class="chat-bubble chat-bubble-agent">
              👋 Hey! I'm OpenOpenInstinct. I can browse the web for you, look up information, book tickets, or check accounts using your private vault. What can I do for you today?
            </div>
            <div class="chat-bubble chat-bubble-user">
              Can you check if there are 2 tickets available for Spider-Man at AMC Metreon tonight around 7 PM?
            </div>
            <div class="chat-bubble chat-bubble-agent">
              I'll check AMC Metreon right now using a Kernel browser session.
              <div class="trace-card">
                ⚙️ <strong>kernel:launch_browser</strong> { headless: true, stealth: true }<br>
                🌐 <strong>kernel:navigate</strong> "https://www.amctheatres.com/movie-theatres/san-francisco/amc-metreon-16"<br>
                🔍 <strong>kernel:find_elements</strong> "Spider-Man showtimes around 19:00"<br>
                ✓ Found 2 standard seats for 7:15 PM in Auditorium 4 (Row F, Seats 14-15).
              </div>
              I found 2 great seats for Spider-Man at 7:15 PM tonight in Auditorium 4 (Row F, Seats 14-15) for $39.50 total. Would you like me to book them with your vaulted Visa card?
            </div>
          </div>

          <div style="padding: 1rem; border-top: 1px solid var(--border); display: flex; gap: 0.5rem; background: var(--card);">
            <input id="chat-input" class="input-field" placeholder="Ask OpenOpenInstinct to browse, reserve, or inspect…" onkeydown="if(event.key==='Enter') sendChatMessage()">
            <button class="btn btn-primary" onclick="sendChatMessage()">Send</button>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-outline btn-sm" onclick="setChatPrompt('Book a table for 2 at Benu this Friday at 7:30 PM')">"Book a table at Benu"</button>
          <button class="btn btn-outline btn-sm" onclick="setChatPrompt('Find the cheapest direct flights from SFO to JFK next week')">"Find SFO to JFK flights"</button>
          <button class="btn btn-outline btn-sm" onclick="setChatPrompt('Check available delivery windows on Whole Foods')">"Check delivery slots"</button>
        </div>
      </section>

      <!-- DEVICE AUTH TAB -->
      <section id="tab-device-auth" class="tab-panel">
        <header>
          <h1 class="type-product-title">Device Authentication Protocol</h1>
          <p class="type-supporting-body" style="color: var(--muted-foreground); margin-top: 0.25rem;">
            Hardware-backed WebCrypto signing keys with zero cloud dependencies and out-of-band recovery.
          </p>
        </header>

        <div class="grid-2">
          <div class="card">
            <h2 class="type-section-title">How It Works</h2>
            <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
              <div style="display: flex; gap: 0.75rem;">
                <div style="background: var(--secondary); width: 1.75rem; height: 1.75rem; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8125rem;">1</div>
                <div>
                  <div class="type-label">One-Use URL Fragment</div>
                  <div class="type-caption" style="color: var(--muted-foreground); margin-top: 0.2rem;">
                    Enrollment uses a 256-bit secret in the URL hash (<code>#v1.&lt;instance&gt;.&lt;pairing&gt;.&lt;secret&gt;</code>) which is never transmitted over HTTP and is wiped from browser history upon arrival.
                  </div>
                </div>
              </div>

              <div style="display: flex; gap: 0.75rem;">
                <div style="background: var(--secondary); width: 1.75rem; height: 1.75rem; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8125rem;">2</div>
                <div>
                  <div class="type-label">Non-Extractable P-256 Key</div>
                  <div class="type-caption" style="color: var(--muted-foreground); margin-top: 0.2rem;">
                    Browser generates an ECDSA P-256 signing key in IndexedDB. Only the public key is registered with your SQLite database.
                  </div>
                </div>
              </div>

              <div style="display: flex; gap: 0.75rem;">
                <div style="background: var(--secondary); width: 1.75rem; height: 1.75rem; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8125rem;">3</div>
                <div>
                  <div class="type-label">Challenge-Response Sessions</div>
                  <div class="type-caption" style="color: var(--muted-foreground); margin-top: 0.2rem;">
                    Sign-in challenges are 2-minute nonces signed by the device key. No passwords or cloud accounts are ever required.
                  </div>
                </div>
              </div>

              <div style="display: flex; gap: 0.75rem;">
                <div style="background: var(--secondary); width: 1.75rem; height: 1.75rem; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8125rem;">4</div>
                <div>
                  <div class="type-label">Out-of-Band Linq Recovery</div>
                  <div class="type-caption" style="color: var(--muted-foreground); margin-top: 0.2rem;">
                    If your public tunnel hostname changes, the server detects the discrepancy and texts a single-tap pairing link to your owner phone number via Linq.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <h2 class="type-section-title">Device Admin CLI</h2>
            <p class="type-supporting-body" style="color: var(--muted-foreground); margin-top: 0.25rem;">
              Manage paired browsers directly from your host terminal:
            </p>

            <div class="code-block" style="margin-top: 1rem;">
<span style="color: var(--muted-foreground);"># Generate a new one-use pairing link</span>
<span style="color: #60a5fa;">pnpm</span> auth:pair --send=linq

<span style="color: var(--muted-foreground);"># List all enrolled devices</span>
<span style="color: #60a5fa;">pnpm</span> auth:devices

<span style="color: var(--muted-foreground);"># Revoke a lost device immediately</span>
<span style="color: #60a5fa;">pnpm</span> auth:revoke --id=&lt;device-id&gt;</div>

            <div style="margin-top: 1.25rem;">
              <button class="btn btn-outline btn-sm" onclick="generateSimulatedPairing()">
                Generate Sample Pairing Token 🎲
              </button>
              <div id="simulated-pairing-result" class="type-code" style="margin-top: 0.5rem; word-break: break-all; color: var(--info); font-size: 0.75rem;"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- SELF-HOST & ARCHITECTURE TAB -->
      <section id="tab-deploy" class="tab-panel">
        <header>
          <h1 class="type-product-title">Self-Host & Deployment</h1>
          <p class="type-supporting-body" style="color: var(--muted-foreground); margin-top: 0.25rem;">
            Run OpenOpenInstinct locally on macOS, Linux, or Windows with zero serverless dependencies.
          </p>
        </header>

        <!-- Architecture Flow -->
        <div class="card">
          <h2 class="type-section-title">Network & Process Architecture</h2>
          <div class="diagram-container" style="margin-top: 1rem;">
            <div class="diagram-step">
              <div class="type-label">📱 Phone / Web</div>
              <div class="type-caption" style="color: var(--muted-foreground);">iMessage / HTTPS</div>
            </div>
            <div class="diagram-arrow">➔</div>
            <div class="diagram-step">
              <div class="type-label">🔒 Secure Tunnel</div>
              <div class="type-caption" style="color: var(--muted-foreground);">Cloudflare / Tailscale / zrok</div>
            </div>
            <div class="diagram-arrow">➔</div>
            <div class="diagram-step">
              <div class="type-label">💻 OpenOpenInstinct</div>
              <div class="type-caption" style="color: var(--muted-foreground);">127.0.0.1:3000 Loopback</div>
            </div>
            <div class="diagram-arrow">➔</div>
            <div class="diagram-step">
              <div class="type-label">🗄️ SQLite + Vault</div>
              <div class="type-caption" style="color: var(--muted-foreground);">AES-256-GCM + WAL</div>
            </div>
          </div>
        </div>

        <!-- Quickstart Guide -->
        <div class="card">
          <h2 class="type-section-title">Quickstart in 4 Commands</h2>
          <div class="code-block" style="margin-top: 1rem;">
<span style="color: var(--muted-foreground);"># 1. Clone repository</span>
git clone https://github.com/maceip/OpenOpenInstinct.git
cd OpenOpenInstinct

<span style="color: var(--muted-foreground);"># 2. Install dependencies with pnpm</span>
corepack enable
pnpm install --frozen-lockfile

<span style="color: var(--muted-foreground);"># 3. Configure environment and run database migrations</span>
cp .env.example .env.local
pnpm db:migrate

<span style="color: var(--muted-foreground);"># 4. Start self-hosted instance with tunnel</span>
pnpm self-host -- --tunnel=cloudflare</div>
        </div>

        <!-- Tunnel Options Table -->
        <div class="card">
          <h2 class="type-section-title">Supported Stable Tunnels</h2>
          <div class="table-container" style="margin-top: 1rem;">
            <table>
              <thead>
                <tr>
                  <th>Tunnel Provider</th>
                  <th>Stable Hostname</th>
                  <th>CLI Configuration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight: 500; color: var(--foreground);">Cloudflare Named Tunnel</td>
                  <td><code>assistant.yourdomain.com</code></td>
                  <td>Set <code>CLOUDFLARED_TOKEN</code>, run <code>pnpm self-host -- --tunnel=cloudflare</code></td>
                </tr>
                <tr>
                  <td style="font-weight: 500; color: var(--foreground);">Tailscale Funnel</td>
                  <td><code>machine.tailnet.ts.net</code></td>
                  <td>Set <code>TAILSCALE_FUNNEL_HOSTNAME</code>, run <code>pnpm self-host -- --tunnel=tailscale</code></td>
                </tr>
                <tr>
                  <td style="font-weight: 500; color: var(--foreground);">zrok Reserved Share</td>
                  <td><code>share.zrok.io</code></td>
                  <td>Set <code>ZROK_RESERVED_SHARE</code>, run <code>pnpm self-host -- --tunnel=zrok</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  </div>

  <footer>
    <div style="max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 0.5rem; align-items: center;">
      <div>Built with <strong>Eve</strong> · <strong>Kernel</strong> · <strong>Linq</strong> · <strong>SQLite</strong></div>
      <div class="type-caption">OpenOpenInstinct — Local-First Agent Architecture · MIT License</div>
    </div>
  </footer>

  <script>
    function switchTab(tabId) {
      document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.nav-button').forEach(el => el.classList.remove('active'));

      const targetPanel = document.getElementById('tab-' + tabId);
      if (targetPanel) targetPanel.classList.add('active');

      const buttons = document.querySelectorAll('.nav-button');
      buttons.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) {
          btn.classList.add('active');
        }
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function toggleTheme() {
      const html = document.documentElement;
      const btn = document.getElementById('theme-btn');
      if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        html.classList.add('light');
        btn.textContent = '☀️ Light';
        localStorage.setItem('theme', 'light');
      } else {
        html.classList.remove('light');
        html.classList.add('dark');
        btn.textContent = '🌙 Dark';
        localStorage.setItem('theme', 'dark');
      }
    }

    // Initialize theme from storage
    if (localStorage.getItem('theme') === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.getElementById('theme-btn').textContent = '☀️ Light';
    }

    function simulateAutofill(itemName) {
      alert('Autofill Simulation: Safely requested ' + itemName + ' from local SQLite encrypted vault.\\nDecrypted via AES-256-GCM in trusted server process and mapped directly to browser DOM inputs.\\nZero raw secret leaked to LLM.');
    }

    function applyTaskPreset(type) {
      const textarea = document.getElementById('task-prompts');
      if (type === 'tickets') {
        textarea.value = "Buy 2 tickets to Spider-Man at AMC Metreon for 7 PM tonight\\nCheck Fandango for Dolby Cinema seats at Century San Francisco";
      } else if (type === 'travel') {
        textarea.value = "Find cheapest nonstop flights SFO -> JFK on United for next Tuesday\\nSearch available rooms at Hyatt Regency Downtown SF for Friday night";
      } else {
        textarea.value = "Buy 2 tickets to Spider-Man tonight at AMC Metreon (center seats)\\nCompare flight prices from SFO to JFK next Tuesday on Google Flights\\nBook a table for 2 at Benu for Friday at 7:30 PM on Resy";
      }
    }

    function startBatchSimulation() {
      const card = document.getElementById('batch-progress-card');
      const container = document.getElementById('batch-workers-container');
      const prompts = document.getElementById('task-prompts').value.trim().split('\\n').filter(Boolean);

      if (prompts.length === 0) {
        alert('Please provide at least one task prompt.');
        return;
      }

      card.style.display = 'block';
      container.innerHTML = '';
      document.getElementById('batch-status-text').textContent = 'Running ' + prompts.length + ' parallel tasks via Kernel Cloud Browsers...';

      prompts.forEach((prompt, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.style.padding = '0.75rem';
        itemDiv.style.background = 'var(--secondary)';
        itemDiv.style.borderRadius = 'var(--radius)';
        itemDiv.style.border = '1px solid var(--border)';
        itemDiv.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">' +
          '<strong>Worker ' + (index + 1) + ': ' + escapeHtml(prompt.substring(0, 45)) + (prompt.length > 45 ? '...' : '') + '</strong>' +
          '<span class="badge badge-info" id="worker-status-' + index + '">Launching...</span>' +
          '</div>' +
          '<div class="type-code" style="font-size:0.75rem; color:var(--muted-foreground);" id="worker-log-' + index + '">Initializing Kernel Chromium session...</div>';
        container.appendChild(itemDiv);
      });

      // Animate progress simulation
      prompts.forEach((_, index) => {
        setTimeout(() => {
          const status = document.getElementById('worker-status-' + index);
          const log = document.getElementById('worker-log-' + index);
          if (status && log) {
            status.textContent = 'Navigating...';
            log.textContent = '🌐 kernel:navigate -> resolving DOM elements with stealth mode';
          }
        }, 800 + index * 400);

        setTimeout(() => {
          const status = document.getElementById('worker-status-' + index);
          const log = document.getElementById('worker-log-' + index);
          if (status && log) {
            status.textContent = 'Filling form...';
            log.textContent = '🔐 vault:fill_from_vault -> securely injected credentials from local SQLite';
          }
        }, 2000 + index * 500);

        setTimeout(() => {
          const status = document.getElementById('worker-status-' + index);
          const log = document.getElementById('worker-log-' + index);
          if (status && log) {
            status.className = 'badge badge-success';
            status.textContent = 'Completed ✓';
            log.textContent = '🎉 complete_task: Succeeded in ' + ((2.4 + index * 0.4).toFixed(1)) + 's';
          }
        }, 3400 + index * 600);
      });
    }

    function setChatPrompt(text) {
      document.getElementById('chat-input').value = text;
      sendChatMessage();
    }

    function sendChatMessage() {
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      if (!text) return;

      const chatContainer = document.getElementById('chat-messages');

      const userBubble = document.createElement('div');
      userBubble.className = 'chat-bubble chat-bubble-user';
      userBubble.textContent = text;
      chatContainer.appendChild(userBubble);
      input.value = '';

      chatContainer.scrollTop = chatContainer.scrollHeight;

      // Simulated agent response
      setTimeout(() => {
        const agentBubble = document.createElement('div');
        agentBubble.className = 'chat-bubble chat-bubble-agent';
        agentBubble.innerHTML = 'Executing your request on Kernel browser...' +
          '<div class="trace-card">' +
          '⚙️ <strong>kernel:launch_browser</strong> { session: "ephemeral-' + Math.random().toString(36).substring(7) + '" }<br>' +
          '🌐 <strong>kernel:execute_task</strong> "' + escapeHtml(text) + '"<br>' +
          '🔐 <strong>vault:check_permissions</strong> Validated workspace token' +
          '</div>' +
          'Task completed successfully! Output verified against criteria.';
        chatContainer.appendChild(agentBubble);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 700);
    }

    function generateSimulatedPairing() {
      const instance = Math.random().toString(36).substring(2, 10);
      const pairing = Math.random().toString(36).substring(2, 14);
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const link = 'https://assistant.example.com/sign-in#v1.' + instance + '.' + pairing + '.' + secret;
      document.getElementById('simulated-pairing-result').textContent = link;
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  </script>
</body>
</html>`;
}

// If run directly via node scripts/build-pages.mjs
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildPages();
}
