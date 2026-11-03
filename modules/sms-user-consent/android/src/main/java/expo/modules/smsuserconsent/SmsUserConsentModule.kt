package expo.modules.smsuserconsent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CONSENT_REQUEST_CODE = 6174

class SmsUserConsentModule : Module() {
  private var receiver: BroadcastReceiver? = null
  private var context: Context? = null

  override fun definition() = ModuleDefinition {
    Name("SmsUserConsent")
    Events("onOtpReceived", "onConsentDismissed", "onSmsConsentError")

    AsyncFunction("start") { promise: Promise ->
      val appContext = appContext.reactContext
      if (appContext == null) {
        promise.reject("E_NO_CONTEXT", "Android context is unavailable.", null)
        return@AsyncFunction
      }
      try {
        registerReceiver(appContext)
        SmsRetriever.getClient(appContext).startSmsUserConsent(null)
          .addOnSuccessListener { promise.resolve(null) }
          .addOnFailureListener { error ->
            unregisterReceiver()
            promise.reject("E_SMS_CONSENT_START", error.message, error)
          }
      } catch (error: Exception) {
        unregisterReceiver()
        promise.reject("E_SMS_CONSENT_START", error.message, error)
      }
    }

    Function("stop") {
      unregisterReceiver()
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != CONSENT_REQUEST_CODE) return@OnActivityResult
      val sms = payload.data?.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE)
      val code = sms?.let {
        Regex("(?<!\\d)\\d{6}(?!\\d)").find(it)?.value
      }
      if (payload.resultCode == android.app.Activity.RESULT_OK &&
        code != null
      ) {
        sendEvent("onOtpReceived", mapOf("code" to code))
      } else {
        sendEvent("onConsentDismissed", emptyMap<String, Any>())
      }
      unregisterReceiver()
    }

    OnDestroy {
      unregisterReceiver()
    }
  }

  private fun registerReceiver(appContext: Context) {
    if (receiver != null) return
    context = appContext
    val smsReceiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
        val status = intent.extras?.get(SmsRetriever.EXTRA_STATUS)
          as? com.google.android.gms.common.api.Status
        when (status?.statusCode) {
          CommonStatusCodes.SUCCESS -> {
            val consentIntent = intent.extras?.get(
              SmsRetriever.EXTRA_CONSENT_INTENT,
            ) as? Intent
            val activity = this@SmsUserConsentModule.appContext
              .activityProvider?.currentActivity
            if (consentIntent != null && activity != null) {
              try {
                activity.startActivityForResult(
                  consentIntent,
                  CONSENT_REQUEST_CODE,
                )
              } catch (_: Exception) {
                this@SmsUserConsentModule.sendEvent(
                  "onSmsConsentError",
                  mapOf("message" to "SMS consent UI is unavailable."),
                )
                this@SmsUserConsentModule.unregisterReceiver()
              }
            } else {
              this@SmsUserConsentModule.sendEvent(
                "onSmsConsentError",
                mapOf("message" to "SMS consent UI is unavailable."),
              )
              this@SmsUserConsentModule.unregisterReceiver()
            }
          }
          CommonStatusCodes.TIMEOUT -> {
            this@SmsUserConsentModule.sendEvent(
              "onSmsConsentError",
              mapOf("message" to "timeout"),
            )
            this@SmsUserConsentModule.unregisterReceiver()
          }
        }
      }
    }
    receiver = smsReceiver
    ContextCompat.registerReceiver(
      appContext,
      smsReceiver,
      IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION),
      SmsRetriever.SEND_PERMISSION,
      null,
      ContextCompat.RECEIVER_EXPORTED,
    )
  }

  private fun unregisterReceiver() {
    val activeContext = context
    val activeReceiver = receiver
    if (activeContext != null && activeReceiver != null) {
      try {
        activeContext.unregisterReceiver(activeReceiver)
      } catch (_: IllegalArgumentException) {
        // The receiver may already have been removed by Android.
      }
    }
    receiver = null
    context = null
  }
}
