# 🚀 Deploy to GitHub - Complete Guide

## 📍 Your GitHub Repository

**Repository:** https://github.com/jsam316/Mtccounter
**Live Site:** https://jsam316.github.io/Mtccounter/

---

## ⚡ Quick Deploy (Easiest Method)

### **For Windows:**
1. Download and extract the ZIP file
2. Open the folder in File Explorer
3. **Double-click** `deploy.bat`
4. Done! ✅

### **For Mac/Linux:**
1. Download and extract the ZIP file
2. Open Terminal
3. Navigate to the folder: `cd /path/to/folder`
4. Run: `./deploy.sh`
5. Done! ✅

---

## 📋 Manual Method (Step by Step)

### **Step 1: Install Git**

If you don't have Git installed:

**Windows:**
- Download from: https://git-scm.com/download/win
- Run installer
- Use default settings

**Mac:**
- Open Terminal
- Run: `brew install git`
- Or install Xcode Command Line Tools

**Linux:**
- Ubuntu/Debian: `sudo apt-get install git`
- Fedora: `sudo dnf install git`

### **Step 2: Configure Git (First Time Only)**

Open Terminal/Command Prompt and run:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### **Step 3: Navigate to Your Folder**

```bash
cd /path/to/your/MTC-Counter-folder
```

### **Step 4: Initialize Git (If First Time)**

```bash
git init
git branch -M main
git remote add origin https://github.com/jsam316/Mtccounter.git
```

### **Step 5: Deploy Your Files**

```bash
# Stage all files
git add .

# Create commit
git commit -m "Updated MTC Counter - Dark theme, New Record button, Fixed exports"

# Push to GitHub
git push -u origin main
```

**If push fails (repo not empty):**
```bash
git push -u origin main --force
```

---

## 🔐 Authentication

GitHub will ask you to authenticate. You have two options:

### **Option 1: GitHub Desktop (Easiest)**
1. Download GitHub Desktop: https://desktop.github.com/
2. Sign in with your GitHub account
3. Clone your repository
4. Copy all files into the cloned folder
5. Commit and push through the GUI

### **Option 2: Personal Access Token**
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (all)
4. Generate token
5. **Save the token** (you won't see it again!)
6. When Git asks for password, use the token

### **Option 3: SSH Key**
1. Follow: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
2. Add SSH key to your GitHub account
3. Use SSH URL: `git@github.com:jsam316/Mtccounter.git`

---

## 📦 What Gets Deployed

Your repository will contain:

✅ **Core Files:**
- `index.html` - Main app
- `manifest.json` - PWA config
- `sw.js` - Service worker
- `icon-192.png` - App icon (small)
- `icon-512.png` - App icon (large)

✅ **Documentation:**
- `README.md` - Main documentation
- `DEPLOYMENT_GUIDE.md` - This guide
- Other guides (optional)

✅ **Config Files:**
- `.gitignore` - Files to ignore

---

## 🌐 Verify Deployment

After pushing:

1. **Check Repository:**
   - Go to: https://github.com/jsam316/Mtccounter
   - Verify files are updated

2. **Check GitHub Pages:**
   - Go to: Repository → Settings → Pages
   - Should show: "Your site is published at https://jsam316.github.io/Mtccounter/"

3. **Wait 1-2 minutes** for GitHub Pages to rebuild

4. **Visit your site:**
   - https://jsam316.github.io/Mtccounter/
   - Hard refresh: `Ctrl + Shift + R` (or `Cmd + Shift + R`)

---

## 🔧 Troubleshooting

### **"Git is not recognized"**
- Git not installed or not in PATH
- Install Git from: https://git-scm.com/

### **"Permission denied (publickey)"**
- Need to set up authentication
- Use GitHub Desktop or Personal Access Token

### **"Failed to push"**
- Repository not empty
- Use: `git push -u origin main --force`

### **"Changes not showing on website"**
- GitHub Pages takes 1-2 minutes to update
- Do hard refresh: `Ctrl + Shift + R`
- Check: Repository → Settings → Pages

### **"Merge conflicts"**
- Someone else pushed changes
- Use: `git pull --rebase origin main`
- Or use force push: `git push --force`

---

## 🔄 Future Updates

To update your site later:

1. **Make changes to files**
2. **Run deployment script:**
   - Windows: Double-click `deploy.bat`
   - Mac/Linux: Run `./deploy.sh`

**Or manually:**
```bash
git add .
git commit -m "Description of changes"
git push
```

---

## 📱 Share Your App

Once deployed, share this URL with your church:

**https://jsam316.github.io/Mtccounter/**

Users can:
- Open in browser
- Add to home screen (iOS/Android)
- Use offline
- Install as PWA

---

## ✅ Deployment Checklist

- [ ] Git installed
- [ ] Repository cloned or initialized
- [ ] All files in folder
- [ ] Run deploy script (or manual commands)
- [ ] Authenticated with GitHub
- [ ] Push successful
- [ ] Wait 1-2 minutes
- [ ] Visit site and hard refresh
- [ ] Test the app
- [ ] ✨ Live and working!

---

## 🆘 Need Help?

If you run into issues:

1. **Check Git version:** `git --version`
2. **Check remote:** `git remote -v`
3. **Check status:** `git status`
4. **View errors** and send me the message

---

**The easiest way is to just double-click the deploy script! 🚀**
