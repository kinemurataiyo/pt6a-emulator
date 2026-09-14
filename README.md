# PT6A Engine Lab

An interactive, self-contained WebGL 2 educational cutaway of the King Air 350's PT6A-60A turboprop engine.

## Upload to your GitHub account

1. Extract the ZIP and open the `pt6a-emulator` folder. You should see `index.html`, JavaScript files, `style.css`, `README.md`, `package.json`, and the `tests` folder.
2. Sign in to [GitHub](https://github.com/new) and create a repository named `pt6a-emulator`. Choose **Public** if you want free GitHub Pages hosting on GitHub Free; this also makes the source code publicly readable. If you only want to store the code, you can choose Private. Leave the initial README option off because one is included here.
3. On the empty repository page, click **uploading an existing file**. In a repository with files, use **Add file > Upload files**.
4. Drag all the files and the `tests` folder from inside the extracted folder into the upload area. Upload the extracted contents, not the ZIP or the outer `pt6a-emulator` folder. `index.html` must appear at the repository's top level.
5. Click **Commit changes**. Your code is now in your GitHub account.

See [GitHub's file upload instructions](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).

## Publish the interactive website with GitHub Pages

1. Open the repository's **Settings > Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select the **main** branch and **/(root)** folder, then click **Save**. If your default branch has a different name, select that branch instead.
4. After deployment finishes, use **Visit site** on the Pages settings screen. With the repository name above, the default address is `https://YOUR-USERNAME.github.io/pt6a-emulator/`.

This export places the app at the repository root. No package installation, API key, or build command is required. The relative asset paths work under a GitHub Pages project URL. Future commits to the published branch update the website.

If the site is not available yet, check the repository's **Actions** tab for the Pages deployment status. If you see a 404 after a successful deployment, check that `index.html` is at the top level and Pages is using **/(root)**.

See [GitHub's publishing instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Run

Serve this project folder with any static web server and open `index.html`. There are no JavaScript dependencies or build step. The optional Google Fonts stylesheet falls back to system fonts offline.

For a local preview, run `python3 -m http.server 8000` from this folder and open `http://localhost:8000`. Open it through a web server instead of double-clicking `index.html`, because the app uses JavaScript modules.

## Explore

- Orbit with dragging; zoom with the wheel or a two-finger pinch; pan with Shift+drag or the right mouse button.
- The focused canvas supports arrow keys to orbit and + / − to zoom.
- Inspect 14 assemblies from the stage list or select the labels on the model.
- Switch cutaway / exterior / X-ray, isolate an assembly, reveal shafts, or separate the assemblies.
- Six combustor views show steady flame, fuel spray, light-off, recirculation, cooling air, and the reverse gas path.
- Replay the illustrative engine start, change power demand or governed propeller speed, and shut down.
- The propeller stage offers forward, feather, and reverse geometry studies.

## Scope and accuracy

The architecture represents three axial compressor stages, one centrifugal impeller, a diffuser, an annular reverse-flow combustor, one compressor turbine, two free power-turbine stages, two-stage planetary reduction, and a four-blade propeller. The two main shafts are separate. The reduction ratio is approximately 17.6:1.

All geometry is schematic. Dimensions, blade profiles and counts, passage shapes, casing details, and accessory arrangements are not manufacturer CAD. Air and flame particles illustrate processes rather than fluid or chemical simulations. Instrument values and transients use a simplified illustrative model; they are not operational limits, measured performance, flight procedures, or maintenance guidance. Study rotation is intentionally far slower than actual rotor speed.

The Model notes dialog contains source links and limitations.

## Validation

Run `npm test` (or `node --test tests/*.test.js`) to check startup order, independent coastdown, governing behavior, torque/power consistency, geometry indices and finite transforms, flow continuity, display-mode traversal, and static control references.

This project is independent of Pratt & Whitney and Textron Aviation.
