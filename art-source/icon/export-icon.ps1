$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$target = $PSScriptRoot
$sizes = @(16,24,32,48,64,128,256,512)
$icoSizes = @(16,24,32,48,64,128,256)
$sourcePath = Join-Path $target 'master.png'
$source = [System.Drawing.Image]::FromFile($sourcePath)
$sourceSize = "$($source.Width)x$($source.Height)"
try {
    foreach ($size in $sizes) {
        $bitmap = [System.Drawing.Bitmap]::new($size,$size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $attributes = [System.Drawing.Imaging.ImageAttributes]::new()
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
            $rectangle = [System.Drawing.Rectangle]::new(0,0,$size,$size)
            $graphics.DrawImage($source,$rectangle,0,0,$source.Width,$source.Height,[System.Drawing.GraphicsUnit]::Pixel,$attributes)
            $bitmap.Save((Join-Path $target "terminal-icon-$size.png"),[System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $attributes.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
    }
} finally { $source.Dispose() }

# Windows icon: all frames are exact lossless PNG exports, with alpha preserved.
$frames = @($icoSizes | ForEach-Object { ,([System.IO.File]::ReadAllBytes((Join-Path $target "terminal-icon-$_.png"))) })
$icoPath = Join-Path $target 'terminal-icon.ico'
$writer = [System.IO.BinaryWriter]::new([System.IO.File]::Create($icoPath))
try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$icoSizes.Count)
    $offset = 6 + 16 * $icoSizes.Count
    for ($index = 0; $index -lt $icoSizes.Count; $index++) {
        $dimension = if ($icoSizes[$index] -eq 256) { 0 } else { $icoSizes[$index] }
        $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
        $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$frames[$index].Length); $writer.Write([uint32]$offset)
        $offset += $frames[$index].Length
    }
    foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
} finally { $writer.Dispose() }

# Native-size inspection board. Images are unscaled against dark and light surfaces.
$board = [System.Drawing.Bitmap]::new(1100,750)
$graphics = [System.Drawing.Graphics]::FromImage($board)
$white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(235,239,240))
$ink = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(12,21,27))
$font = [System.Drawing.Font]::new('Segoe UI',12)
$smallFont = [System.Drawing.Font]::new('Segoe UI',9)
try {
    $graphics.Clear($ink.Color)
    $graphics.DrawString('BLACKSITE RELAY / INDUSTRIAL TERMINAL / NATIVE SIZE CHECK',$font,$white,24,18)
    $graphics.FillRectangle($white,0,360,1100,390)
    $graphics.DrawString('Same exports on a light Windows background',$font,$ink,24,375)
    $x = 24
    foreach ($size in $icoSizes) {
        $art = [System.Drawing.Image]::FromFile((Join-Path $target "terminal-icon-$size.png"))
        try {
            $graphics.DrawString("${size}px",$smallFont,$white,$x,56)
            $graphics.DrawImageUnscaled($art,$x,86)
            $graphics.DrawString("${size}px",$smallFont,$ink,$x,411)
            $graphics.DrawImageUnscaled($art,$x,441)
            $x += [Math]::Max($size + 40,96)
        } finally { $art.Dispose() }
    }
    $board.Save((Join-Path $target 'native-size-preview.png'),[System.Drawing.Imaging.ImageFormat]::Png)
} finally { $graphics.Dispose(); $board.Dispose(); $white.Dispose(); $ink.Dispose(); $font.Dispose(); $smallFont.Dispose() }

foreach ($size in @(16,32)) {
    $art = [System.Drawing.Image]::FromFile((Join-Path $target "terminal-icon-$size.png"))
    $enlarged = [System.Drawing.Bitmap]::new(512,512)
    $graphics = [System.Drawing.Graphics]::FromImage($enlarged)
    try {
        $graphics.Clear([System.Drawing.Color]::FromArgb(12,21,27))
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
        $graphics.DrawImage($art,[System.Drawing.Rectangle]::new(0,0,512,512),0,0,$size,$size,[System.Drawing.GraphicsUnit]::Pixel)
        $enlarged.Save((Join-Path $target "inspection-${size}px-enlarged.png"),[System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $enlarged.Dispose(); $art.Dispose() }
}

# Read the exported ICO structure and compare every frame with its PNG byte-for-byte.
$reader = [System.IO.BinaryReader]::new([System.IO.File]::OpenRead($icoPath))
$validation = [System.Collections.Generic.List[string]]::new()
$validation.Add('BLACKSITE RELAY / INDUSTRIAL TERMINAL / EXPORT VALIDATION')
$validation.Add("Master: $sourceSize, unchanged selected ImageGen artwork.")
$validation.Add("Master SHA256: $((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash)")
$validation.Add('Conversion only: full original framing; GDI+ high-quality bicubic scaling; no regeneration, repainting, recoloring or cropping.')
try {
    if ($reader.ReadUInt16() -ne 0 -or $reader.ReadUInt16() -ne 1 -or $reader.ReadUInt16() -ne 7) { throw 'Invalid ICO header' }
    for ($index = 0; $index -lt $icoSizes.Count; $index++) {
        $width = $reader.ReadByte(); if ($width -eq 0) { $width = 256 }
        $height = $reader.ReadByte(); if ($height -eq 0) { $height = 256 }
        $null = $reader.ReadByte(); $null = $reader.ReadByte()
        $planes = $reader.ReadUInt16(); $depth = $reader.ReadUInt16()
        $length = $reader.ReadUInt32(); $frameOffset = $reader.ReadUInt32()
        $returnOffset = $reader.BaseStream.Position
        $reader.BaseStream.Position = $frameOffset
        $embedded = $reader.ReadBytes($length)
        $reader.BaseStream.Position = $returnOffset
        if ($width -ne $icoSizes[$index] -or $height -ne $width -or $planes -ne 1 -or $depth -ne 32) { throw 'Invalid ICO frame metadata' }
        if ([Convert]::ToBase64String($embedded) -cne [Convert]::ToBase64String($frames[$index])) { throw "ICO mismatch: $width" }
        $validation.Add("ICO ${width}x${height}: 32-bit; lossless PNG frame exactly matches export ($length bytes).")
    }
} finally { $reader.Dispose() }
foreach ($size in $sizes) {
    $bitmap = [System.Drawing.Bitmap]::new((Join-Path $target "terminal-icon-$size.png"))
    try {
        if ($bitmap.Width -ne $size -or $bitmap.Height -ne $size) { throw "Invalid PNG dimensions: $size" }
        if ($bitmap.GetPixel(0,0).A -ne 0 -or $bitmap.GetPixel($size-1,$size-1).A -ne 0) { throw "Missing PNG alpha: $size" }
        $validation.Add("PNG ${size}x${size}: exact dimensions; transparent corners verified.")
    } finally { $bitmap.Dispose() }
}
if (-not ('TerminalIconNativeProbe' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class TerminalIconNativeProbe {
    [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern IntPtr LoadImage(IntPtr instance, string path, uint type, int cx, int cy, uint flags);
    [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr icon);
}
'@
}
$iconHandle = [TerminalIconNativeProbe]::LoadImage([IntPtr]::Zero,$icoPath,1,256,256,16)
if ($iconHandle -eq [IntPtr]::Zero) { throw 'Windows native LoadImage failed' }
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)
try {
    if ($icon.Width -ne 256 -or $icon.Height -ne 256) { throw 'Windows icon decode failed' }
    $validation.Add('Windows native LoadImage decode: PASS, 256x256.')
} finally { $icon.Dispose(); [TerminalIconNativeProbe]::DestroyIcon($iconHandle) | Out-Null }
$validation | Set-Content -LiteralPath (Join-Path $target 'validation.txt') -Encoding UTF8
$validation
