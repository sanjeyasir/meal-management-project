$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$htmlPath = "file:///d:/firebaselearning/meal-management-project/portal_user_manual.html"
$pdfOut = "d:\firebaselearning\meal-management-project\public\docs\Meal_Management_Web_Portal_User_Manual.pdf"
$userDir = "d:\firebaselearning\meal-management-project\scratch\edge_profile"

if (-not (Test-Path "d:\firebaselearning\meal-management-project\public\docs")) {
    New-Item -ItemType Directory -Force -Path "d:\firebaselearning\meal-management-project\public\docs" | Out-Null
}
if (-not (Test-Path $userDir)) {
    New-Item -ItemType Directory -Force -Path $userDir | Out-Null
}

& $edge --headless=new --user-data-dir="$userDir" --disable-gpu --no-pdf-header-footer "--print-to-pdf=$pdfOut" "$htmlPath"

Start-Sleep -Seconds 4

if (Test-Path $pdfOut) {
    Copy-Item $pdfOut "d:\firebaselearning\meal-management-project\screenshots\Meal_Management_Web_Portal_User_Manual.pdf" -Force
    Get-Item $pdfOut | Select-Object Name, Length, LastWriteTime
    Write-Host "PDF Generation Succeeded!"
} else {
    Write-Error "PDF was not created."
}
