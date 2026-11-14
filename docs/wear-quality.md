# Wear OS app quality checklist (RaHel)

Source: https://developer.android.com/docs/quality-guidelines/wear-app-quality — reviewed against the app at version 1.0.16 (code 17).
"Verified" means checked in code or in the built bundle. Nothing here has been seen on a physical watch yet: use the last column to check on a real device before each submission.

| ID | Requirement | Status | Notes / how to check on the watch |
|---|---|---|---|
| WO-V1 | Respect the user's font size; nothing cut off or overlapping | Fixed in 1.0.15 | Side margins 18 dp, centered detail text, pairing code fits its width at any scale. Set *Settings → Display → Font size* to the maximum and open an alert detail and the Sync page |
| WO-V2 | 48 dp touch targets | Verified | Compact chips use the library tap-target padding (checked in compose-material 1.4.0-beta03, the resolved version) |
| WO-V3 | Swipe to close | Improved | System back/swipe goes back one step in the alert detail and in onboarding before leaving the app |
| WO-V4 | Ongoing activity for long-running work | Done in 1.0.14 | Start monitoring → indicator on the watch face and chip in recent apps |
| WO-V5 | Preserve state | Partial | Onboarding keeps its steps while the process lives; not restored after process death |
| WO-V6 | Launcher icon and name | OK | Adaptive icon from the RaHel logo |
| WO-V8 | Scroll bar on scrollable views | Done in 1.0.14 | All scrollable screens go through `WearScrollScreen` (position indicator) |
| WO-V9 | Tile: signed-out / not set up | Done in 1.0.16 | Tile shows "Set up RaHel…" with a "Get started" chip until onboarding is complete |
| WO-V10 | Tile preview | Fixed in 1.0.16 | `tile_preview.png` showed the template text "Hello World!"; replaced with the real tile |
| WO-V13 | Black background | Fixed in 1.0.16 | Theme background was dark green; `Scaffold` paints it. Now `Color.Black` |
| WO-V14 | Min font 12 sp essential / 10 sp other | Verified | No custom sizes below 12 sp |
| WO-V15 | 48 dp **circular** icon on black at startup, matching the launcher icon | Fixed in 1.0.16 | Was a rounded square. Cold-start the app and look |
| WO-V16 | Fits a 192 dp circle, nothing cut off | Improved | Same as WO-V1; check on a small round watch if possible |
| WO-P1 | Target API | OK | targetSdk 36 |
| WO-P6 | No username/password on the watch | OK | Pairing uses a one-time code entered on the web |
| WO-G2 | Listing: main features, mention tile/complication, no "Android Wear" | Done | See `docs/play-store/ficha.md` |
| WO-G5 | At least one 1:1 screenshot of the app UI only | **To do (manual)** | Take them from the watch/emulator ("Play Store Compatible"); a tile screenshot is recommended |

Lessons from the first rejections: the template tile and complication were still showing sample content, and a theme change (Scaffold) silently changed the background. Re-run this table before every submission.
