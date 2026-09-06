package kz.dentvision.crm

import android.app.Application
import kz.dentvision.crm.data.ServiceLocator
import kz.dentvision.crm.lib.CrashHandler

class DentVisionApp : Application() {
    override fun onCreate() {
        super.onCreate()
        CrashHandler.install(this)
        ServiceLocator.init(this)
    }
}
