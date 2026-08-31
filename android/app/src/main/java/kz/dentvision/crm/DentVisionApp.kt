package kz.dentvision.crm

import android.app.Application
import kz.dentvision.crm.data.ServiceLocator

class DentVisionApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ServiceLocator.init(this)
    }
}
