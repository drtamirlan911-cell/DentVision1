package kz.dentvision.crm.data.session

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Шифрует то, что `SessionStore`/`GuestSessionStore` кладут на диск через
 * DataStore: ключ живёт в Android Keystore и никогда не покидает защищённое
 * хранилище устройства, наружу уходит только шифротекст. Без этого слоя
 * токены лежали бы в файле DataStore открытым текстом, читаемым на
 * рутованном устройстве или через `adb backup`.
 */
internal object SecureCipher {
    private const val KEYSTORE = "AndroidKeyStore"
    private const val KEY_ALIAS = "dv_session_v1"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_BITS = 128

    private fun key(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    fun encrypt(plaintext: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, key()) }
        val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        val iv = Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
        val body = Base64.encodeToString(ciphertext, Base64.NO_WRAP)
        return "$iv:$body"
    }

    /** null если расшифровать не удалось (испорченные данные, смена ключа Keystore при переустановке) — вызывающий тогда считает, что сессии нет. */
    fun decrypt(payload: String): String? = runCatching {
        val (ivB64, bodyB64) = payload.split(":", limit = 2)
        val iv = Base64.decode(ivB64, Base64.NO_WRAP)
        val ciphertext = Base64.decode(bodyB64, Base64.NO_WRAP)
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(GCM_TAG_BITS, iv))
        }
        String(cipher.doFinal(ciphertext), Charsets.UTF_8)
    }.getOrNull()
}
