# RepoDoctor

> A lightweight CLI tool for analyzing the health of GitHub and local repositories.

RepoDoctor scans a repository and generates a **health score out of 100** based on practical engineering checks such as documentation, licensing, tests, GitHub Actions, dependency health, `.gitignore` configuration, and potential secrets.

It works with both **local repositories** and **public GitHub repositories**.

---

## ✨ Features

* 🔍 Scan local repositories
* 🌐 Scan public GitHub repositories directly from a URL
* 📊 Generate an overall repository health score
* 📖 Check README quality
* ⚖️ Detect repository license
* 🧪 Analyze test configuration
* 🚫 Check `.gitignore` configuration
* ⚙️ Inspect GitHub Actions workflows
* 🔗 Check documentation links
* 📦 Analyze dependency updates
* 🔐 Detect potential secrets
* 📄 Export scan results as JSON
* 🖥️ Clean terminal output with colored status indicators

---

## 📋 Example

Run RepoDoctor against the React repository:

```bash
node dist/cli.js scan https://github.com/facebook/react
```

Example output:

```text
RepoDoctor
────────────────────────

GitHub Repository
  Repository: react/react
  Stars: 247,435
  Forks: 51,240
  Open Issues: 1,256
  Default Branch: main
  Language: JavaScript
  Archived: No

Health Score: 73/100

✓ README Quality: 100/100
  README contains basic installation and usage information.

✓ License: 100/100
  License file found.

✓ Tests: 90/100
  Framework: Jest, test script configured.

✗ .gitignore: 50/100
  .env is not explicitly ignored.

✓ GitHub Actions: 95/100
  Workflows found and configured.

✓ Documentation Links: 100/100
  No broken local links found.

✗ Dependencies: 47/100
  Dependency updates are available.

✗ Secret Detection: 80/100
  Potential secrets require review.
```

---

## 🚀 Getting Started

### Requirements

Make sure you have:

* Node.js installed
* npm installed
* Git installed and available in your `PATH`

Check your installations:

```bash
node --version
npm --version
git --version
```

---

## 📦 Installation

Clone the repository:

```bash
git clone https://github.com/Zohaibcode740/RepoDoctor.git
```

Move into the project directory:

```bash
cd RepoDoctor
```

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

---

## 🔎 Scanning a Repository

### Scan the current directory

```bash
node dist/cli.js scan
```

### Scan a local repository

```bash
node dist/cli.js scan C:\path\to\repository
```

### Scan a GitHub repository

```bash
node dist/cli.js scan https://github.com/facebook/react
```

RepoDoctor automatically retrieves GitHub repository metadata and temporarily clones the repository for analysis.

The temporary clone is removed after the scan.

---

## 📄 JSON Output

You can request machine-readable JSON output:

```bash
node dist/cli.js scan https://github.com/facebook/react --json
```

This is useful when integrating RepoDoctor with:

* CI/CD pipelines
* dashboards
* automation scripts
* other developer tools

---

## 💾 Save a Report

Save the scan result to a JSON file:

```bash
node dist/cli.js scan https://github.com/facebook/react --report report.json
```

You can also combine both options:

```bash
node dist/cli.js scan https://github.com/facebook/react --json --report report.json
```

---

## 🧪 Testing

Run the automated test suite:

```bash
npm test
```

Current project tests cover core functionality including:

* dependency analysis
* secret detection

Build the project with:

```bash
npm run build
```

---

## 🏗️ Development

Run RepoDoctor directly from TypeScript during development:

```bash
npm run dev -- scan https://github.com/facebook/react
```

Start the compiled application:

```bash
npm start -- scan https://github.com/facebook/react
```

---

## 📊 Health Score

RepoDoctor calculates a score from multiple repository checks.

The goal is not to claim that a repository is objectively "good" or "bad". Instead, the score provides a quick engineering-health signal based on the checks RepoDoctor currently performs.

A repository can therefore receive a lower score because of issues such as:

* missing `.env` protection
* outdated dependencies
* missing tests
* missing license information
* weak documentation
* potentially exposed secrets
* incomplete CI configuration

---

## 🔐 Secret Detection

RepoDoctor can identify patterns that **may represent secrets or credentials**.

Important:

> Secret detection results are warnings, not proof that a credential is actually exposed.

Every reported result should be manually reviewed before taking action.

If a real credential is discovered, revoke or rotate it immediately.

---

## 🌐 GitHub Repository Support

RepoDoctor accepts GitHub repository URLs such as:

```text
https://github.com/facebook/react
https://github.com/facebook/react.git
https://github.com/facebook/react/
https://www.github.com/facebook/react
```

Private repositories are currently not supported unless authentication support is added in a future version.

---

## 🛠️ Technology Stack

RepoDoctor is built with:

* **TypeScript**
* **Node.js**
* **Commander** — CLI argument handling
* **Chalk** — terminal styling
* **Ora** — terminal progress indicators
* **Vitest** — testing
* **Git** — repository cloning

---

## 📁 Project Structure

```text
RepoDoctor/
├── src/
│   ├── cli.ts
│   ├── github.ts
│   ├── scanner.ts
│   └── ...
├── tests/
├── dist/
├── package.json
├── package-lock.json
├── tsconfig.json
├── LICENSE
└── README.md
```

---

## 🎯 Project Status

RepoDoctor is currently under active development.

### Completed

* [x] CLI foundation
* [x] Local repository scanning
* [x] GitHub repository scanning
* [x] GitHub repository metadata
* [x] Repository health scoring
* [x] README analysis
* [x] License detection
* [x] Test detection
* [x] `.gitignore` analysis
* [x] GitHub Actions analysis
* [x] Documentation link checking
* [x] Dependency analysis
* [x] Secret detection
* [x] JSON output
* [x] JSON report generation
* [x] Automated tests
* [x] TypeScript build

### Planned

* [ ] Windows installer (`Setup.exe`)
* [ ] Easier installation for non-technical users
* [ ] Global CLI installation
* [ ] Improved reporting
* [ ] More repository health checks
* [ ] CI/CD integration
* [ ] Release binaries
* [ ] GitHub release automation

---

## 🗺️ Roadmap

### Phase 1 — Core Scanner

Repository analysis and basic health checks.

### Phase 2 — GitHub Integration

GitHub URL scanning, repository metadata, and temporary cloning.

### Phase 3 — Advanced Checks

Dependencies, secrets, workflows, documentation links, and additional health signals.

### Phase 4 — CLI & Reporting

CLI options, JSON output, reports, error handling, and automated tests.

### Phase 5 — Packaging

Create a user-friendly Windows installer so users can install RepoDoctor without manually setting up Node.js and the project environment.

### Phase 6 — Distribution

Prepare public releases, GitHub Releases, versioning, documentation, and distribution workflow.

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch:

```bash
git checkout -b feature/my-feature
```

3. Make your changes.
4. Run the tests:

```bash
npm test
```

5. Build the project:

```bash
npm run build
```

6. Commit your changes:

```bash
git commit -m "Add my feature"
```

7. Push your branch:

```bash
git push origin feature/my-feature
```

8. Open a Pull Request.

---

## 📜 License

This project is licensed under the MIT License.

See the [`LICENSE`](LICENSE) file for details.

---

## 👨‍💻 Author

**Zohaib**

GitHub: [@Zohaibcode740](https://github.com/Zohaibcode740)

Project: [RepoDoctor](https://github.com/Zohaibcode740/RepoDoctor)

---

## ⭐ Support

If RepoDoctor is useful to you, consider giving the repository a ⭐ on GitHub.
