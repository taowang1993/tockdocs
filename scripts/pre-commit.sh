#!/bin/sh
# Pre-commit hook: scan staged changes for secrets using TruffleHog.
# Covers 887+ credential types with live-validation.
# Install: brew install trufflehog
set -eu

export TRUFFLEHOG_PRE_COMMIT=1
trufflehog git file://. --fail
