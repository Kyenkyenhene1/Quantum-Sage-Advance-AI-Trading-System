# Local verification script for Windows PowerShell
# - Checks Node/npm availability
# - Installs dependencies
# - Runs typecheck, build, and tests
# Usage: Open a new PowerShell, navigate to the repo root and run: `powershell -ExecutionPolicy Bypass -File .\\scripts\\local-verify.ps1`

function Check-Command {
    param([string]$cmd)
    $which = Get-Command $cmd -ErrorAction SilentlyContinue
    return $null -ne $which
}

if (-not (Check-Command npm)) {
    Write-Error "npm is not available in PATH. Install Node.js (LTS) or use nvm-windows."
    Write-Host "Quick install via winget (requires Windows 10/11):"
    Write-Host "  winget install OpenJS.Nodejs.LTS"
    exit 2
}

Write-Host "Installing dependencies (this may take a while)..."
npm ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }










exit $LASTEXITCODEnpm run testWrite-Host "Running unit tests..."if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }npm run buildWrite-Host "Building project..."nWrite-Host "Running typecheck..."
nnpm run typecheck
nif ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }