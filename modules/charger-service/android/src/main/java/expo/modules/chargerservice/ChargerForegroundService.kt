package expo.modules.chargerservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder

class ChargerForegroundService : Service() {
  private var player: MediaPlayer? = null

  // Avisos de carregador só chegam para receptores registrados em tempo de execução
  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      when (intent.action) {
        Intent.ACTION_POWER_CONNECTED -> play(KEY_CONNECT)
        Intent.ACTION_POWER_DISCONNECTED -> play(KEY_DISCONNECT)
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    startInForeground()

    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_POWER_CONNECTED)
      addAction(Intent.ACTION_POWER_DISCONNECTED)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      registerReceiver(receiver, filter)
    }
    running = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    running = false
    try {
      unregisterReceiver(receiver)
    } catch (_: IllegalArgumentException) {
    }
    player?.release()
    player = null
    super.onDestroy()
  }

  private fun startInForeground() {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun buildNotification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Monitoramento do carregador", NotificationManager.IMPORTANCE_LOW)
      )
      Notification.Builder(this, CHANNEL_ID)
    } else {
      Notification.Builder(this)
    }

    // Toque na notificação abre o app
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    if (launchIntent != null) {
      builder.setContentIntent(
        PendingIntent.getActivity(this, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE)
      )
    }

    return builder
      .setSmallIcon(android.R.drawable.ic_lock_idle_charging)
      .setContentTitle("Charger Sounds")
      .setContentText("Monitorando o carregador")
      .setOngoing(true)
      .build()
  }

  private fun play(key: String) {
    val uri = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(key, null) ?: return

    player?.release()
    player = null

    try {
      val mediaPlayer = MediaPlayer()
      mediaPlayer.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
          .build()
      )
      mediaPlayer.setDataSource(this, Uri.parse(uri))
      mediaPlayer.setOnPreparedListener { it.start() }
      mediaPlayer.setOnCompletionListener {
        it.release()
        if (player === it) player = null
      }
      mediaPlayer.setOnErrorListener { mp, _, _ ->
        mp.release()
        if (player === mp) player = null
        true
      }
      player = mediaPlayer
      mediaPlayer.prepareAsync()
    } catch (_: Exception) {
      player?.release()
      player = null
    }
  }

  companion object {
    const val PREFS = "charger_sounds"
    const val KEY_CONNECT = "connect"
    const val KEY_DISCONNECT = "disconnect"
    private const val CHANNEL_ID = "charger_monitor"
    private const val NOTIFICATION_ID = 1001

    @Volatile
    var running = false
  }
}
