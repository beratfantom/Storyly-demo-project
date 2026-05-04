# Storyly Demo Platform

AI-powered app clone generator for Storyly sales demos.

## Quick Start (Local)

```bash
npm install
npm start
```

Opens at http://localhost:3000

## Deploy to Vercel (Free)

### Option A — GitHub + Vercel (Recommended)

1. Create a GitHub account (if you don't have one): https://github.com
2. Create a new repository: https://github.com/new
   - Name: `storyly-demo`
   - Keep it Public or Private
   - Click "Create repository"

3. Upload these project files to the repository:
   - Click "uploading an existing file" on the empty repo page
   - Drag & drop ALL files and folders from this project
   - Click "Commit changes"

4. Go to https://vercel.com and sign up with your GitHub account

5. Click "Add New Project"
   - Import your `storyly-demo` repository
   - Framework Preset: "Create React App" (auto-detected)
   - Click "Deploy"

6. Wait 1-2 minutes — your site is live!
   - URL will be something like: `storyly-demo-xxx.vercel.app`
   - Share this URL with anyone

### Option B — Vercel CLI (For developers)

```bash
npm install -g vercel
vercel login
vercel
```

## How It Works

1. Enter brand name + colors
2. Upload app screenshots (1-3)  
3. Click "Generate App Clone" — AI analyzes screenshots and builds a scrollable UI clone
4. Upload images into Gallery slots (story covers, video feed, banner, canvas products)
5. Toggle widgets on/off in Config
6. Share the link!

## Features

- 🤖 AI-powered app clone generation (Claude API)
- 📱 Dual phone preview (before vs after)
- 🖼 Gallery system for image uploads
- ⚙ Widget toggles (Stories, Banners, Video Feed, Canvas)
- 🎯 Interactive story overlay (5 slides)
- 🌍 EN/TR language support
