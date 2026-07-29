# 3D first-person build (Unity WebGL) goes here

This folder hosts the Unity WebGL export of the RE:Verse first-person slice.
Until the build is added, `index.html` here is a "coming soon" placeholder.

The shipped slice is a **greybox** — geometry composed from Unity primitives in
C#, kept until the modular kit replaces it. It is not the target look.

## How to produce & drop in the build

1. **Open the Unity project** `unity/RE-Verse-Unity/` (Unity **6.x LTS** with
   **WebGL Build Support**), run **RE:Verse ▸ Configure URP** once, and press
   Play to confirm it runs.

   > The project is on **URP**. Two consequences for a WebGL build: the master
   > shaders must be in the always-included list (`WebGLBuilder.cs` handles it —
   > a stripped shader renders black, not an error), and once interiors are
   > lightmapped, the bake ships in the build and the payload grows with it.

2. **Player Settings → Publishing Settings — this is the critical part for
   GitHub Pages:**
   - **Compression Format → `Disabled`** (GitHub Pages cannot send the
     `Content-Encoding` header that Brotli/Gzip builds need). Alternatively keep
     Gzip **and** tick **Decompression Fallback**, but `Disabled` is simplest and
     most reliable on a static host.
   - **Data Caching** on is fine.

3. **File → Build Settings → WebGL → Build**, output to a temp folder. Unity
   produces:
   ```
   index.html
   Build/            (*.data, *.wasm, *.framework.js, *.loader.js)
   TemplateData/
   ```

4. **Copy those into this `3d/` folder**, overwriting this placeholder
   `index.html`. The launcher at the site root already links here (`3d/`).

5. **Size check (GitHub Pages limits):** no single file may exceed **100 MB**,
   and keep the repo comfortably under ~1 GB. This greybox slice should be small
   (a few MB). If a `.data`/`.wasm` file is over 100 MB, either trim the build or
   switch that file to **Git LFS** before pushing.

6. Commit & push — the Pages workflow redeploys automatically:
   ```bash
   git add 3d/
   git commit -m "feat - Add Unity WebGL 3D first-person build"
   git push
   ```
   Then the 3D slice is live at `https://re-verse-game.github.io/beta/3d/`.
