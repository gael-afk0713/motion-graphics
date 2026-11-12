# PC (Windows) environment for this project: dot-source it in each PowerShell before the tools.
#   . scripts\pc_env.ps1
# - earshot lives in its own venv (C:\Users\gaels\.earshot-venv), installed with pip because
#   `uv tool install` failed on this PC (uv could not link its managed Python).
# - full ffmpeg/ffprobe from winget (Gyan.FFmpeg): the minimal ffmpeg bundled with Remotion cannot
#   decode to a pipe, which earshot needs.
$ffBin = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty DirectoryName
$env:PATH = "C:\Users\gaels\.earshot-venv\Scripts;$ffBin;$env:PATH"
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"
