#!/bin/bash

echo "========================================"
echo "MTC Counter - GitHub Deployment Script"
echo "========================================"
echo ""

# Check if Git is installed
if ! command -v git &> /dev/null; then
    echo "ERROR: Git is not installed!"
    echo "Please install Git first:"
    echo "  Mac: brew install git"
    echo "  Linux: sudo apt-get install git"
    exit 1
fi

echo "Git detected! Proceeding with deployment..."
echo ""

# Initialize Git if needed
if [ ! -d .git ]; then
    echo "Initializing Git repository..."
    git init
    git branch -M main
fi

# Add remote if not exists
if ! git remote get-url origin &> /dev/null; then
    echo "Adding GitHub remote..."
    git remote add origin https://github.com/jsam316/Mtccounter.git
fi

echo ""
echo "Staging files..."
git add .

echo ""
echo "Creating commit..."
git commit -m "Updated MTC Counter - Dark theme, New Record button, Fixed exports"

echo ""
echo "Pushing to GitHub..."
if ! git push -u origin main; then
    echo ""
    echo "========================================"
    echo "PUSH FAILED - Trying force push..."
    echo "========================================"
    git push -u origin main --force
fi

echo ""
echo "========================================"
echo "SUCCESS! Your site will be live at:"
echo "https://jsam316.github.io/Mtccounter/"
echo "========================================"
echo ""
echo "Note: It may take 1-2 minutes for GitHub Pages to update"
echo ""
