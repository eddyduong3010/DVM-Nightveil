$ErrorActionPreference = 'Stop'
# Use the module belonging to this PowerShell host, not an inherited PS7 path.
Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$taskFiles = @(Get-ChildItem -LiteralPath "$PSScriptRoot/../artifacts" -Filter '*.exe' -File)
$taskFiles += Get-Item -LiteralPath "$PSScriptRoot/../artifacts/win-unpacked/DVM Nightveil.exe"
if ($taskFiles.Count -lt 2) { throw 'Missing installer or application' }
foreach ($taskFile in $taskFiles) {
    $taskSignature = Get-AuthenticodeSignature -LiteralPath $taskFile.FullName
    if ($taskSignature.Status -ne 'Valid') { throw "Invalid signature: $($taskFile.Name): $($taskSignature.Status)" }
    if (-not $taskSignature.TimeStamperCertificate) { throw "Missing timestamp: $($taskFile.Name)" }
    Write-Output "Verified signature and timestamp: $($taskFile.Name)"
}
