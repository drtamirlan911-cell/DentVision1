plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "kz.dentvision.crm"
    compileSdk = 35

    defaultConfig {
        applicationId = "kz.dentvision.crm"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        // Совпадает с версией платформы в package.json (2.0.0).
        versionName = "2.0.0"
    }

    buildTypes {
        debug {
            // Тот же адрес, что и локальная разработка веба (localhost:3001);
            // 10.0.2.2 — как эмулятор Android видит localhost машины-хоста.
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3001\"")
        }
        release {
            // Ровно то значение, которое зашито в src/utils/api.ts как
            // продакшн-адрес API.
            buildConfigField("String", "API_BASE_URL", "\"https://dentvision-api.onrender.com\"")
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }

        /**
         * Сборка, которую можно поставить на настоящий телефон.
         *
         * Без неё такой сборки не было вовсе, и это дефект, а не недосмотр в
         * мелочи: `debug` ставится, но ходит на 10.0.2.2 — адрес, которым
         * эмулятор видит localhost машины, и на телефоне не значащий ничего;
         * `release` ходит куда надо, но `signingConfig` у него не задан, а
         * неподписанный APK Android установить откажется. Одна сборка ставится
         * и никуда не ходит, вторая ходит и не ставится.
         *
         * Подпись — отладочным ключом. Он есть у любого Android SDK, не требует
         * держать секреты в репозитории и достаточен, чтобы телефон разрешил
         * установку. Для магазина и для раздачи сотрудникам такая подпись не
         * годится и не предназначена — потому это отдельный тип сборки, а не
         * подпись, приделанная к `release`: граница между «поставить себе» и
         * «выпустить» должна остаться видимой.
         *
         * Открытый трафик сюда не протекает: `usesCleartextTraffic` объявлен в
         * `app/src/debug/AndroidManifest.xml` и действует только на `debug`.
         */
        create("preview") {
            initWith(getByName("release"))
            signingConfig = signingConfigs.getByName("debug")
            buildConfigField("String", "API_BASE_URL", "\"https://dentvision-api.onrender.com\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.datastore.preferences)

    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.coil.compose)

    testImplementation(libs.junit)
}
