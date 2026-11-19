package expo.modules.chargerservice

import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ChargerServiceModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("Contexto indisponível")

  override fun definition() = ModuleDefinition {
    Name("ChargerService")

    // Guarda os caminhos dos áudios para o serviço usar
    Function("setSounds") { connectUri: String?, disconnectUri: String? ->
      context
        .getSharedPreferences(ChargerForegroundService.PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString(ChargerForegroundService.KEY_CONNECT, connectUri)
        .putString(ChargerForegroundService.KEY_DISCONNECT, disconnectUri)
        .apply()
    }

    Function("start") {
      val intent = Intent(context, ChargerForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    Function("stop") {
      context.stopService(Intent(context, ChargerForegroundService::class.java))
    }

    Function("isRunning") {
      ChargerForegroundService.running
    }
  }
}
