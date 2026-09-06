# DocSpace Android Template Project (Jetpack Compose)

This directory is a **fully decoupled, standalone Android project** built with Kotlin and Jetpack Compose (Material3).

## Key Characteristics
- **Native & Offline First**: Displays the doctor's full profile, speciality, bio, location, and verified badges completely offline.
- **Dynamic Services & Booking**: Features an interactive in-clinic appointment booking form UI and optional telehealth, pharmacy, and diagnostic cards.
- **Theming**: Strict visual parity with the DocSpace web patient app (`Slate50`, `Brand600`, `Brand700`, `Emerald600`, `Indigo600`).
- **Template Injection**: The backend dynamically injects doctor branding into `app/build.gradle.kts`, `AndroidManifest.xml`, `strings.xml`, and `DoctorConfig.kt` before compiling the APK.

## Standalone Android Studio Usage
You can open this `android-template/` directory directly in **Android Studio**:
1. Open Android Studio → Select **Open** → Navigate to `Doctors Platform/android-template`.
2. Gradle will sync dependencies automatically.
3. Replace the placeholder values in `DoctorConfig.kt` with your own test data to preview composables in the Compose Preview tool.

