# 换头像：选一张图，按中心正方形裁切，输出 256×256 的 public/images/site/avatar.jpg
# 用法：换头像.bat（双击选图，或把图片拖上去）
param(
  [string]$Path = '',
  [int]$Size = 256
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'public\images\site'
$out = Join-Path $outDir 'avatar.jpg'

function PickImage {
  Add-Type -AssemblyName System.Windows.Forms
  $dlg = New-Object System.Windows.Forms.OpenFileDialog
  $dlg.Title = '选一张图片当头像'
  $dlg.Filter = '图片 (*.jpg;*.jpeg;*.png;*.bmp;*.tif;*.tiff)|*.jpg;*.jpeg;*.png;*.bmp;*.tif;*.tiff|所有文件 (*.*)|*.*'
  $dlg.CheckFileExists = $true
  if ($dlg.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return '' }
  return $dlg.FileName
}

try {
  if (-not $Path) { $Path = PickImage }
  if (-not $Path) {
    Write-Host '没有选择图片，头像保持不变。'
    exit 2
  }

  $Path = $Path.Trim('"').Trim()
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Write-Host "找不到这个文件：$Path"
    exit 1
  }

  $fileName = Split-Path $Path -Leaf
  $src = [System.Drawing.Image]::FromFile($Path)

  # 按 EXIF 方向摆正（手机拍的竖图经常带旋转标记）
  try {
    $orientation = 1
    foreach ($id in $src.PropertyIdList) {
      if ($id -eq 0x0112) { $orientation = [int]$src.GetPropertyItem(0x0112).Value[0] }
    }
    switch ($orientation) {
      2 { $src.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX) }
      3 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
      4 { $src.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipY) }
      5 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipX) }
      6 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
      7 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipX) }
      8 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
    }
  } catch {
    # 读不到 EXIF 就按原方向来
  }

  $w = $src.Width
  $h = $src.Height
  $side = [Math]::Min($w, $h)
  $x = [int][Math]::Floor(($w - $side) / 2)
  $y = [int][Math]::Floor(($h - $side) / 2)

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  # 透明 PNG 铺成站点卡片底色，避免变成黑底
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#fbfbf9'))
  $destRect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
  $srcRect = New-Object System.Drawing.Rectangle($x, $y, $side, $side)
  $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()

  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]90)
  $bmp.Save($out, $codec, $params)
  $bmp.Dispose()
  $src.Dispose()

  # 清掉旧的其它格式，免得和 avatar.jpg 混淆
  foreach ($ext in 'png', 'webp', 'gif', 'jpeg') {
    $stale = Join-Path $outDir "avatar.$ext"
    if (Test-Path -LiteralPath $stale) { Remove-Item -LiteralPath $stale -Force }
  }

  $kb = [math]::Round((Get-Item -LiteralPath $out).Length / 1KB, 0)
  Write-Host ''
  Write-Host "选中的图片：$fileName（$w×$h）"
  if ($w -eq $h) {
    Write-Host "本来就是正方形，缩放成 $Size×$Size"
  } else {
    Write-Host "取中间 $side×$side 的正方形，缩放成 $Size×$Size"
  }
  Write-Host "已写入：public\images\site\avatar.jpg（$kb KB）"
  exit 0
} catch {
  Write-Host "换头像失败：$($_.Exception.Message)"
  exit 1
}
