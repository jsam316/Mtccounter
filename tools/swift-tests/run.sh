#!/usr/bin/env bash
# Compiles the iOS app's pure-Swift model code with these tests and runs them.
# Used by .github/workflows/ios-build.yml (needs macOS with Xcode).
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="$(mktemp -d)/swift-tests"
swiftc -o "$OUT" \
  MtcCounter/Models/AttendanceRecord.swift \
  MtcCounter/Models/ScriptureData.swift \
  MtcCounter/Models/Lectionary.swift \
  MtcCounter/Models/LectionaryData.swift \
  MtcCounter/Models/Backup.swift \
  tools/swift-tests/main.swift
"$OUT"
