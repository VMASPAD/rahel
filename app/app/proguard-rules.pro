# ---- RaHel release rules (R8 / minify + shrinkResources) ----
-keepattributes Signature, *Annotation*, InnerClasses, EnclosingMethod, RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile

# Gson / Retrofit DTOs: serialized by reflection on field names, so keep every class in
# the remote package (request/response DTOs and Retrofit service interfaces) with all members.
-keep class xyz.targapps.rahel.data.remote.** { *; }
# Mapper/queue payloads parsed with Gson.fromJson(Class)
-keepclassmembers class xyz.targapps.rahel.domain.** { <fields>; }

# Gson
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
-keepclassmembers,allowobfuscation class * { @com.google.gson.annotations.SerializedName <fields>; }
-dontwarn sun.misc.**

# Retrofit (generic return types of suspend functions)
-keepattributes AnnotationDefault
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*
-if interface * { @retrofit2.http.* <methods>; }
-keep,allowobfuscation interface <1>
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
-keep,allowobfuscation,allowshrinking class retrofit2.Response

# OkHttp / Okio
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Room (entities, DAOs, database are also covered by Room's own consumer rules)
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-keep class xyz.targapps.rahel.data.local.** { *; }

# WorkManager workers are instantiated by class name
-keep class * extends androidx.work.ListenableWorker { <init>(...); }

# Android components declared in the manifest are kept by AAPT; keep Tile/Complication/Service entry points explicitly
-keep class xyz.targapps.rahel.tile.** { *; }
-keep class xyz.targapps.rahel.complication.** { *; }
-keep class xyz.targapps.rahel.service.** { *; }

# Health Services client
-keep class androidx.health.services.client.** { *; }
-dontwarn androidx.health.**

# Kotlin
-dontwarn kotlin.**
-keep class kotlin.Metadata { *; }
