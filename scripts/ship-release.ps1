# Helper to run tests, create branch, push, and open a PR.
# Usage: from repo root in PowerShell: `.	ools\ship-release.ps1` or `.	emplates\ship-release.ps1`
Param(
  [string]$BranchName = 'feat/observability-audit',
  [string]$CommitMessage = 'feat(observability): add metrics, tracing, audit, and tests',
  [string]$PrTitle = 'feat: observability, audit, and execution metrics',
  [string]$PrBodyFile = 'PR_DESCRIPTION.md'
)

function Check-Tool($cmd) {
  $p = Get-Command $cmd -ErrorAction SilentlyContinue
  return $null -ne $p
}

Write-Host "Ship-release helper starting..."

if (-not (Check-Tool 'git')) {
  Write-Host "git not found in PATH. Please install git and re-run. Aborting." -ForegroundColor Red
  exit 2
}

# Run tests via Docker Compose if available, otherwise try npm test
if (Check-Tool 'docker') {
  Write-Host "Running tests via Docker Compose..."
  docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
  if ($LASTEXITCODE -ne 0) { Write-Host "Tests failed. Fix failures before creating PR." -ForegroundColor Red; exit $LASTEXITCODE }
} elseif (Check-Tool 'npm') {
  Write-Host "Docker not available, running native tests (ensure build tools installed)..."
  npm ci
  npm test
  if ($LASTEXITCODE -ne 0) { Write-Host "Tests failed. Fix failures before creating PR." -ForegroundColor Red; exit $LASTEXITCODE }
} else {
  Write-Host "Neither Docker nor npm found. Please run tests locally and re-run this script." -ForegroundColor Yellow
  exit 2
}

Write-Host "Tests passed. Creating branch '$BranchName'..."
git checkout -b $BranchName
git add -A
git commit -m $CommitMessage

if (-not (Check-Tool 'gh')) {
  Write-Host "GitHub CLI (gh) not found. I'll push branch but cannot create PR automatically." -ForegroundColor Yellow
  git push -u origin $BranchName
  Write-Host "To create a PR, run:" -ForegroundColor Green
  Write-Host "  gh pr create --title `"$PrTitle`" --body-file $PrBodyFile --base main --head $BranchName" -ForegroundColor Cyan
  exit 0
}

# Push and create PR via gh
git push -u origin $BranchName
Write-Host "Creating PR via gh..."
gh pr create --title "$PrTitle" --body-file $PrBodyFile --base main --head $BranchName

Write-Host "PR created. Please review and request reviewers as needed." -ForegroundColor Green
