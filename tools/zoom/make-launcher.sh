#!/bin/zsh
# Rebuilds /Applications/On Air.app: a double-click launcher that opens OBS and
# starts its virtual camera once OBS is ready (see on-air.mjs). Needs node at
# /opt/homebrew/bin/node and OBS Studio installed (brew install --cask obs).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="/Applications/On Air.app"
ICON_SRC="$HERE/../../assets/icon-512.png"
T="$(mktemp -d)"

rm -rf "$APP"
osacompile -o "$APP" -e 'do shell script "/opt/homebrew/bin/node " & quoted form of POSIX path of (path to resource "on-air.mjs")'
cp "$HERE/on-air.mjs" "$APP/Contents/Resources/on-air.mjs"

# Icon: the site's mark, as a proper .icns
mkdir -p "$T/OnAir.iconset"
for s in 16 32 128 256 512; do
  sips -z $s $s "$ICON_SRC" --out "$T/OnAir.iconset/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2)); [ $d -le 1024 ] && sips -z $d $d "$ICON_SRC" --out "$T/OnAir.iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$T/OnAir.iconset" -o "$APP/Contents/Resources/OnAir.icns"
rm -f "$APP/Contents/Resources/Assets.car"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile OnAir" "$APP/Contents/Info.plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string OnAir" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$APP/Contents/Info.plist" 2>/dev/null || true
codesign --force --sign - "$APP" >/dev/null 2>&1
touch "$APP"
rm -rf "$T"
echo "built $APP"
