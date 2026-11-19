<div align="center">

<img src="docs/logo.png" alt="PHOENIXA" width="200" />

# PHOENIXA for Vega OS

**A cinematic Jellyfin client for the new Amazon Fire TV devices that run Vega OS.**

The same look and remote controls as [PHOENIXA for Android TV / Fire TV](https://github.com/hansonds/PHOENIXA), rebuilt with React Native for Vega.

</div>

---

## ✦ What it is

PHOENIXA is a native TV app for your Jellyfin server, with its own elegant dark theme. Every screen is designed around the remote, so you always know where the highlight is and how to get back. Videos play the original file directly (no server transcoding).

## ✨ Features

- **Sign in** with your server address and username/password, or **Quick Connect** (no typing on the remote).
- **Home**: featured carousel with title logos and badges, Continue Watching, Next Up, Recently Added for each library, My Favorites.
- **Library grids** (Recently Added, A–Z, Top Rated, Release Year, Random), **Favorites** with filters, **Search**.
- **Details**: logo, info, genres, tagline, "Ends at", Version / Audio / Subtitles pickers, seasons and episodes, Cast & Crew, actor pages with biography, More Like This, mark watched and favourite.
- **Player**: plays the original file straight from your server (no transcoding), audio and subtitle tracks with real language names (your choice is remembered), speed, screen size, synopsis and cast, seek bar with hold-to-scrub, ±10 s, auto-play next episode, watch progress synced to your server.
- **Search & Add** for servers with the [Torvia](https://github.com/hansonds/Torvia-Jellyfin) plugin: search, filter releases, add to TorBox, My adds.
- **11 colour themes**, card size, streaming quality, auto-play and carousel settings, **About** page.

### Audio on Vega OS
Fire TV devices with Vega OS can't play **Dolby TrueHD**, and play **DTS** only by passing it to a soundbar or receiver that supports DTS. PHOENIXA picks another audio track of the file (for example AC3 or E-AC3) when there is one, and tells you clearly when a file has no audio track this TV can play.

## 📥 Download

Every push to `main` is built automatically by GitHub Actions. Get the newest `.vpkg` files from **[Releases → latest](https://github.com/hansonds/PHOENIXA-Vega/releases/tag/latest)**:

- `PHOENIXA_x86_64.vpkg`: Vega Virtual Device on a Windows/Linux PC
- `PHOENIXA_armv7.vpkg`: Fire TV Stick with Vega OS
- `PHOENIXA_aarch64.vpkg`: Vega Virtual Device on an Apple M-series Mac

Run a downloaded package on the virtual device:

```bash
vega virtual-device start
vega run-app PHOENIXA_x86_64.vpkg org.phoenicx.nova.main -d VirtualDevice
```

## 🛠 Build it yourself

You need the **Vega SDK 2.0** (with the Vega CLI) and **Node.js 22.14 or newer**.

```bash
git clone https://github.com/hansonds/PHOENIXA-Vega.git
cd PHOENIXA-Vega
npm install
npm run build:release
```

The build creates `.vpkg` files:

| File | For |
|---|---|
| `build/x86_64-release/*.vpkg` | Vega Virtual Device on an Intel/AMD computer |
| `build/aarch64-release/*.vpkg` | Vega Virtual Device on an Apple M-series Mac |
| `build/armv7-release/*.vpkg` | Fire TV Stick with Vega OS |

Start the virtual device, then install and open the app:

```bash
vega virtual-device start
vega run-app "$(ls build/x86_64-release/*.vpkg)" org.phoenicx.nova.main -d VirtualDevice
```

## 🎮 Remote controls

| Where | Button | Action |
|---|---|---|
| Anywhere | **Back** | Go back one step |
| Home banner | **◀ ▶** on the edge buttons | Previous / next featured title |
| Home rows | **▲** on the first row | Jump to the banner, then the top bar |
| Home rows | **Back** | Jump to the banner |
| Text boxes | **OK** | Open the keyboard |

## 🙏 Credits

- Created by **Hanson** · [phoenicx.org](https://phoenicx.org) · [github.com/hansonds](https://github.com/hansonds)
- Powered by **[Jellyfin](https://jellyfin.org)**, the free software media system.
- Built with **React Native for Vega** (Amazon Vega SDK).
- Icons: [Material Design Icons](https://github.com/google/material-design-icons) (Apache 2.0).

PHOENIXA is an independent project and is not affiliated with or endorsed by the Jellyfin project or Amazon.
