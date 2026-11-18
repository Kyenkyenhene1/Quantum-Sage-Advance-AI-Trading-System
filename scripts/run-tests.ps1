# PowerShell helper to run the test suite using Docker Compose (recommended)
Param()

Write-Host "Running tests via docker compose..."
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit

$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
  Write-Host "Tests failed with exit code $exitCode"
  exit $exitCode
}
Write-Host "Tests completed successfully."
