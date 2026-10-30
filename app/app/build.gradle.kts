import java.util.Properties

/** LAN IP of the dev machine (Wi‑Fi). Override in `local.properties` → API_BASE_URL */
fun resolveDebugApiBaseUrl(): String {
    val props = Properties()
    listOf(
        rootProject.file("local.properties"),
        rootProject.file("../local.properties"),
        file("local.properties"),
    ).firstOrNull { it.exists() }?.inputStream()?.use { props.load(it) }
    val fromLocal = props.getProperty("API_BASE_URL")?.trim()
    if (!fromLocal.isNullOrEmpty()) {
        val url = if (fromLocal.endsWith("/")) fromLocal else "$fromLocal/"
        return "\"$url\""
    }
    return "\"http://192.168.1.24:8080/api/\""
}

/**
 * Release signing: reads `app/keystore.properties` (storeFile, storePassword, keyAlias, keyPassword)
 * or env vars RAHEL_KEYSTORE_FILE / RAHEL_KEYSTORE_PASSWORD / RAHEL_KEY_ALIAS / RAHEL_KEY_PASSWORD.
 * Returns null when nothing is configured -> release is built UNSIGNED (never fails).
 */
fun loadReleaseSigning(): Map<String, String>? {
    val props = Properties()
    listOf(rootProject.file("app/keystore.properties"), file("../keystore.properties"), file("keystore.properties"))
        .firstOrNull { it.exists() }?.inputStream()?.use { props.load(it) }
    fun v(prop: String, env: String): String? =
        (props.getProperty(prop) ?: System.getenv(env))?.trim()?.takeIf { it.isNotEmpty() }
    val file = v("storeFile", "RAHEL_KEYSTORE_FILE") ?: return null
    val storePw = v("storePassword", "RAHEL_KEYSTORE_PASSWORD") ?: return null
    val alias = v("keyAlias", "RAHEL_KEY_ALIAS") ?: return null
    val keyPw = v("keyPassword", "RAHEL_KEY_PASSWORD") ?: storePw
    return mapOf("storeFile" to file, "storePassword" to storePw, "keyAlias" to alias, "keyPassword" to keyPw)
}

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "xyz.targapps.rahel"
    compileSdk {
        version = release(36)
    }

    defaultConfig {
        applicationId = "xyz.targapps.rahel"
        minSdk = 30
        targetSdk = 36
        versionCode = 17
        versionName = "1.0.16"

        // Release URL; debug overrides in buildTypes.debug (see resolveDebugApiBaseUrl).
        buildConfigField("String", "API_BASE_URL", "\"https://rahel.hermesbackend.xyz/api/\"")
    }

    val releaseSigning = loadReleaseSigning()
    signingConfigs {
        if (releaseSigning != null) {
            create("release") {
                storeFile = file(releaseSigning.getValue("storeFile"))
                storePassword = releaseSigning.getValue("storePassword")
                keyAlias = releaseSigning.getValue("keyAlias")
                keyPassword = releaseSigning.getValue("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            // Host on LAN (wlp8s0). Paths: pairing/code, profile, … under /api/
            buildConfigField("String", "API_BASE_URL", resolveDebugApiBaseUrl())
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.findByName("release")
            buildConfigField(
                "String",
                "API_BASE_URL",
                "\"https://rahel.hermesbackend.xyz/api/\"",
            )
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    testOptions {
        unitTests.isReturnDefaultValues = true
    }
    useLibrary("wear-sdk")
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.play.services.wearable)
    implementation(platform(libs.compose.bom))
    implementation("androidx.compose.material:material-icons-extended")
    implementation(libs.ui)
    implementation(libs.ui.graphics)
    implementation(libs.ui.tooling.preview)
    implementation(libs.compose.material)
    implementation(libs.compose.foundation)
    implementation(libs.wear.tooling.preview)
    implementation(libs.activity.compose)
    implementation(libs.core.splashscreen)
    implementation(libs.tiles)
    implementation(libs.tiles.material)
    implementation(libs.tiles.tooling.preview)
    implementation(libs.horologist.compose.tools)
    implementation(libs.horologist.tiles)
    implementation(libs.watchface.complications.data.source.ktx)
    implementation(libs.wear.ongoing)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.runtime.ktx)
    implementation(libs.health.services.client)
    implementation(libs.datastore.preferences)
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.gson)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.gson)
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)
    implementation(libs.work.runtime.ktx)
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.ui.test.junit4)
    debugImplementation(libs.ui.tooling)
    debugImplementation(libs.ui.test.manifest)
    debugImplementation(libs.tiles.tooling)
}