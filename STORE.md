# Amazon Appstore submission — PHOENIXA for Vega OS

Everything needed to submit PHOENIXA for Fire TV devices with Vega OS.

## 1. The file to upload

From **[Releases → latest](https://github.com/hansonds/PHOENIXA-Vega/releases/tag/latest)** download **`PHOENIXA_armv7.vpkg`**.
That is the build for real Fire TV devices with Vega OS. (The `x86_64` file is only for the virtual device on a PC.)

- Package ID: `org.phoenicx.nova` (the same ID as the Android PHOENIXA)
- Version: `1.0.0` (from `package.json`)
- Build number: the GitHub build number, shown in the release title. It goes up by one with every build, so an update always has a higher number, which the Appstore requires.
- The manifest registers the main launcher category (`com.amazon.category.main`), which the Appstore checks.

## 2. Add it to the existing PHOENIXA app (recommended) or create a new app

- **If PHOENIXA (Android) is already in your Developer Console:** open it → **Add upcoming version** (or the current draft) → **App files** → upload the `.vpkg` next to the APK. The Android and Vega versions then share one listing, one description and one set of screenshots.
- **If not:** **Apps & Services → My Apps → Add new app → Fire TV**, then upload the `.vpkg` on the **Upload Your App File** screen.

## 3. Pictures (in the `store/` folder of this repo)

| File | Size | Use |
|---|---|---|
| `store/icon_512.png` | 512 × 512 | Large icon |
| `store/icon_114.png` | 114 × 114 | Small icon |
| `store/icon_1280x720.png` | 1280 × 720 | Fire TV app icon / banner (if asked) |
| `store/background_1920x1080.png` | 1920 × 1080 | Fire TV background image |

**Screenshots (3 to 10, 1920 × 1080):** take them on the virtual device (Home, a details page, a library, Settings). Use titles with free artwork (for example the open movies *Big Buck Bunny*, *Sintel*, *Tears of Steel*) or blur posters. Real movie posters and logos in screenshots are a common reason for an "intellectual property" rejection.

## 4. Listing text

**Title:** PHOENIXA

**Short description:**
A cinematic Jellyfin client for Fire TV — big artwork, calm remote navigation, direct play.

**Long description:**
PHOENIXA is a beautiful, remote-friendly app for your own Jellyfin media server.

• Featured carousel with title logos, ratings and quality badges (4K, HDR, Dolby Vision, Atmos)
• Continue Watching, Next Up, Recently Added for each library and your Favorites
• Library grids with sorting, Favorites and Search
• Detailed pages with seasons and episodes, cast and crew, actor biographies and More Like This
• Choose the version, audio track and subtitles before you press Play; your language choice is remembered
• Plays your files directly, with no conversion on your server
• Watch progress syncs with your server, so you can continue on any device; next episode plays automatically
• Quick Connect sign-in: no typing with the remote
• 11 colour themes and three card sizes

PHOENIXA needs a Jellyfin server (free, open-source software you run yourself). It does not provide any movies or shows.
Made by Hanson · phoenicx.org. PHOENIXA is not affiliated with or endorsed by the Jellyfin project.

**Category:** Video Players & Editors (or Entertainment)
**Keywords:** jellyfin, media server, home media, movies, tv shows, player, streaming, phoenixa
**Privacy policy URL:** https://github.com/hansonds/PHOENIXA-Vega/blob/main/PRIVACY.md
**Content rating:** answer "None" to all content questions (the app shows only the user's own media).
**Ads:** No. **In-app purchases:** No. **Login required:** Yes (your own Jellyfin server).

## 5. Notes for the Amazon review team (Testing Instructions box)

Phoenixfin was once rejected because the reviewer couldn't sign in, so give them a working account:

1. On your Jellyfin server create a user only for Amazon, e.g. **`amazonreview`** with a simple password, and give it access only to a small library of free/open movies (Big Buck Bunny, Sintel, Tears of Steel). Use **H.264 or HEVC video with AAC, AC3 or E-AC3 audio**, so every file plays on Vega.
2. Check the account works from outside your home (your server must be reachable from the USA).
3. Paste this into the testing instructions:

```
PHOENIXA is a client for the user's own Jellyfin media server.
Test server: https://media.phoenicx.org
Username: amazonreview
Password: <the password you set>

Steps: open PHOENIXA → Sign in → enter the server, username and password → Sign In.
Home shows a featured banner and rows. Open a movie → Play.
Settings → "Test the player" plays a short sample video without any server.
```

## 6. Other ways to test on a real Vega device before or after submitting

- **Live App Testing** (Developer Console → your app → Live App Testing): upload the same `PHOENIXA_armv7.vpkg` and invite testers by email. Anyone with a Fire TV that runs Vega OS can install it from the Appstore before it is public.
- **A Vega Fire TV Stick** (Fire TV Stick 4K Select): register it for Developer Mode in the Developer Console and install the `.vpkg` over USB with `vega run-app PHOENIXA_armv7.vpkg org.phoenicx.nova.main -d <device serial>`.
- **The Amazon review itself** runs on real Vega hardware; if playback fails they report what they saw.
