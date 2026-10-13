param([int]$ParentProcessId=0)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class MayhemKeys {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X, Y; }
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder text, int size);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr window, ref Point point);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out Rect rect, int size);
}
'@
# Report physical pixels for game geometry and clicks, even on mixed-DPI displays.
try { $null=[MayhemKeys]::SetThreadDpiAwarenessContext([IntPtr](-4)) } catch { }
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$codes = [ordered]@{
  SCAN_SELF = 0x77
  SCAN_SELF_CHORD = 0x41
  SCAN_ENEMY_CHORD = 0x45
  OWN_1 = 0x31
  OWN_2 = 0x32
  OWN_3 = 0x33
  OVERLAY = 0x4F
  SIDE = 0x4D
  MAIN = 0x43
  CYCLE = 0x20
  INTERACT = 0x49
}
$held = @{}
$mouseHeld = $false
$title = New-Object System.Text.StringBuilder 256
$lastGameRect = ''
$lastClientRect = ''
$geometryTick = 0
$tabSince = 0L
$tabSent = $false
$tabHeld = $false
$parentTick = 0
$lastForegroundWindow = [IntPtr]::Zero
$lastForegroundGame = $false
$foregroundTick = 0
$wasInGame = $false
[Console]::WriteLine('READY')
while ($true) {
  $parentTick++
  if ($ParentProcessId -gt 0 -and $parentTick -ge 36) {
    $parentTick=0
    try { $null=[System.Diagnostics.Process]::GetProcessById($ParentProcessId) } catch { break }
  }
  $null = $title.Clear()
  $window = [MayhemKeys]::GetForegroundWindow()
  $null = [MayhemKeys]::GetWindowText($window, $title, $title.Capacity)
  $foregroundTick++
  if ($window -ne $lastForegroundWindow -or $foregroundTick -ge 18) {
    $foregroundTick = 0
    $lastForegroundWindow = $window
    $lastForegroundGame = $false
    try {
      $foregroundPid = [uint32]0
      $null = [MayhemKeys]::GetWindowThreadProcessId($window, [ref]$foregroundPid)
      if ($foregroundPid -gt 0) {
        $lastForegroundGame = [System.Diagnostics.Process]::GetProcessById([int]$foregroundPid).ProcessName -like 'League of Legends*'
      }
    } catch { }
  }
  $inGame = $lastForegroundGame -or $title.ToString() -eq 'League of Legends (TM) Client'
  if ($inGame -and -not $wasInGame) { [Console]::WriteLine('GAME_FOCUS') }
  if (-not $inGame -and $wasInGame) { [Console]::WriteLine('GAME_BLUR') }
  $wasInGame = $inGame
  if ($title.ToString() -eq 'League of Legends') {
    $clientBox = [MayhemKeys+Rect]::new()
    $clientPoint = [MayhemKeys+Point]::new()
    if ([MayhemKeys]::GetClientRect($window, [ref]$clientBox) -and [MayhemKeys]::ClientToScreen($window, [ref]$clientPoint)) {
      $line="CLIENT_RECT $($clientPoint.X) $($clientPoint.Y) $($clientBox.Right-$clientBox.Left) $($clientBox.Bottom-$clientBox.Top)"
      if ($line -ne $lastClientRect) { [Console]::WriteLine($line); $lastClientRect=$line }
    }
  }
  if ($inGame) {
    $geometryTick++
    if ($lastGameRect -eq '' -or $geometryTick -ge 18) {
    $geometryTick = 0
    $rect = [MayhemKeys+Rect]::new()
    $point = [MayhemKeys+Point]::new()
    if ([MayhemKeys]::GetClientRect($window, [ref]$rect) -and [MayhemKeys]::ClientToScreen($window, [ref]$point)) {
      $width = $rect.Right - $rect.Left
      $height = $rect.Bottom - $rect.Top
      $nowGameRect = "GAME_RECT $($point.X) $($point.Y) $width $height"
      if ($width -gt 200 -and $height -gt 200 -and $nowGameRect -ne $lastGameRect) {
        [Console]::WriteLine($nowGameRect)
        $outer = [MayhemKeys+Rect]::new()
        if ([MayhemKeys]::DwmGetWindowAttribute($window,9,[ref]$outer,16) -eq 0) {
          [Console]::WriteLine("GAME_WINDOW $($outer.Left) $($outer.Top) $($outer.Right-$outer.Left) $($outer.Bottom-$outer.Top)")
        }
        $lastGameRect = $nowGameRect
      }
    }
    }
  } elseif ($lastGameRect) {
    $lastGameRect = ''
    $geometryTick = 0
  }
  $ctrl = ([MayhemKeys]::GetAsyncKeyState(0x11) -band 0x8000) -ne 0
  $shift = ([MayhemKeys]::GetAsyncKeyState(0x10) -band 0x8000) -ne 0
  $tabDown = $inGame -and (([MayhemKeys]::GetAsyncKeyState(0x09) -band 0x8000) -ne 0)
  if ($tabDown -ne $tabHeld) { if ($tabDown) { [Console]::WriteLine('TAB_DOWN') } else { [Console]::WriteLine('TAB_UP') }; $tabHeld=$tabDown }
  if ($tabDown) {
    if ($tabSince -eq 0) { $tabSince=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
    if (-not $tabSent -and [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $tabSince -ge 600) { [Console]::WriteLine('TAB_READY'); $tabSent=$true }
  } else { $tabSince=0L; $tabSent=$false }
  $mouseDown = $inGame -and (([MayhemKeys]::GetAsyncKeyState(0x01) -band 0x8000) -ne 0)
  if ($mouseDown -and -not $mouseHeld) {
    $cursor = [MayhemKeys+Point]::new()
    if ([MayhemKeys]::GetCursorPos([ref]$cursor)) { [Console]::WriteLine("GAME_CLICK $($cursor.X) $($cursor.Y)") }
  }
  $mouseHeld = $mouseDown
  foreach ($name in $codes.Keys) {
    $down = $inGame -and (([MayhemKeys]::GetAsyncKeyState([int]$codes[$name]) -band 0x8000) -ne 0)
    if ($name -ne 'SCAN_SELF') { $down = $down -and $ctrl -and $shift }
    if ($down -and -not $held[$name]) { [Console]::WriteLine($name) }
    $held[$name] = $down
  }
  if ($inGame) { Start-Sleep -Milliseconds 55 } else { Start-Sleep -Milliseconds 200 }
}
