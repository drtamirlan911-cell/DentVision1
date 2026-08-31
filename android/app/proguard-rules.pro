# kotlinx.serialization: сериализаторы находятся по аннотациям, их имена нужны.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class kz.dentvision.crm.data.model.** {
    *** Companion;
}
-keepclasseswithmembers class kz.dentvision.crm.data.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}
