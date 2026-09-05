# ⛪ MTC Counter - MarThoma Church Attendance Tracker

A modern, bilingual (English/Malayalam) Progressive Web App for tracking church service attendance.

## ✨ Features

- 📊 **Real-time Counter** - Track male/female attendance
- 👥 **Co-Celebrants Support** - Optional field for multiple celebrants
- 🌐 **Bilingual** - Full English and Malayalam support
- 🌙 **Dark/Light Mode** - Easy on the eyes
- 📱 **Mobile Optimized** - Swipe gestures, haptic feedback
- 💾 **Offline Support** - Works without internet
- 📄 **Export Options** - PDF & Text export
- 📅 **History Tracking** - View and load past records
- 📖 **Scripture Reference** - Track sermon details

## 🚀 Quick Start

### **Option 1: Open Directly** (Easiest)
Just open `index.html` in your browser. All data saves locally!

### **Option 2: Install as App** (Recommended)
See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions on:
- Installing on iOS & Android
- Hosting on GitHub Pages (FREE)
- Deploying to web servers

## 📱 How to Install on Your Phone

### **iPhone/iPad:**
1. Host the app online (see deployment guide)
2. Open in Safari
3. Tap Share → "Add to Home Screen"

### **Android:**
1. Host the app online (see deployment guide)
2. Open in Chrome
3. Tap Menu → "Install app"

## 🎯 Usage

1. **Select Date** - Pick the service date
2. **Enter Details** - Parish, celebrant, sermon info
3. **Count Attendance** - Use +/- buttons for male/female counts
4. **Save Record** - Store for future reference
5. **View History** - Access past records anytime
6. **Export Data** - Generate PDF or text reports

## 🌍 Language Support

Switch between English and Malayalam by clicking the **ML/EN** button in the top right corner.

## 💾 Data Storage

All your data is stored locally in your browser using localStorage. Your records are private and never leave your device unless you choose to export them.

## 📦 What's Included

- `index.html` - Main application file
- `manifest.json` - PWA configuration
- `sw.js` - Service worker for offline functionality
- `icon-192.png` - App icon (192x192)
- `icon-512.png` - App icon (512x512)
- `DEPLOYMENT_GUIDE.md` - Complete deployment instructions

## 🔒 Privacy

- ✅ No data collection
- ✅ No tracking
- ✅ No external servers
- ✅ Everything stays on your device
- ✅ Offline-first design

## 🛠️ Tech Stack

- Pure HTML, CSS, JavaScript
- jsPDF for PDF generation
- Service Workers for offline support
- Progressive Web App (PWA) standards

## 📝 License

Free to use for any MarThoma Church parish. 

---

**Made with ❤️ for MarThoma Church communities**

## ☁️ Cloud backup (Google Drive)

The app can back up its records automatically to the user's **own Google Drive**
(a hidden app-data folder — the app cannot see any other Drive files) after
every save, and restore/merge them on any device. It is off until a Google
OAuth Client ID is configured. One-time setup, about 10 minutes:

1. Go to https://console.cloud.google.com and create a project (e.g. "MTC Counter").
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → External → fill in the app
   name and support email → add the scope
   `https://www.googleapis.com/auth/drive.appdata` → save, then **Publish**
   the app (this scope is non-sensitive, so no Google verification is needed).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   → Application type **Web application** → under **Authorized JavaScript
   origins** add `https://jsam316.github.io` (and `http://localhost:8000` if
   you test locally) → Create.
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) into
   `src/config.js`:
   ```js
   export const GOOGLE_CLIENT_ID = 'xxxxxxxx.apps.googleusercontent.com';
   ```
6. Commit and deploy. The **Cloud backup** card in the History tab now shows
   **Connect Google Drive**.

Notes
- The Client ID is a public identifier, not a secret; the origin list is what
  protects it.
- Restore **merges**: records are matched by date and the newer one wins;
  nothing is ever deleted by a restore.
- If the phone is offline when a save happens, the backup is marked pending
  and uploads automatically when the connection returns.
