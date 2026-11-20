package io.kamishikii.dindin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.Vibrator;

import org.json.JSONObject;

import java.io.File;

public class RingService extends Service {
    public static final String CH = "dindin_alarm";
    public static final int NOTIF = 1;
    public static String currentId = null;
    public static String currentTime = "";
    public static String currentNote = "";

    private MediaPlayer mp;
    private Vibrator vib;
    private PowerManager.WakeLock wl;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        String action = intent.getStringExtra("action");
        String id = intent.getStringExtra("id");
        if ("STOP".equals(action)) { stopSelf(); return START_NOT_STICKY; }
        if ("SNOOZE".equals(action)) {
            if (id != null) AlarmScheduler.scheduleSnooze(this, id, 5);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (id == null) { stopSelf(); return START_NOT_STICKY; }

        JSONObject a = AlarmScheduler.find(this, id);
        currentId = id;
        currentTime = a != null ? a.optString("time", "") : "";
        currentNote = a != null ? a.optString("note", "") : "";

        createChannel();
        startForeground(NOTIF, buildNotification(id));

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "dindin:ring");
        wl.acquire(10 * 60 * 1000L);

        startSound(a);
        vib = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vib != null && vib.hasVibrator()) vib.vibrate(new long[]{0, 600, 400}, 0);

        handler.postDelayed(this::stopSelf, 10 * 60 * 1000L); // максимум 10 минут, как у обычных будильников
        return START_NOT_STICKY;
    }

    private void startSound(JSONObject a) {
        try {
            mp = new MediaPlayer();
            Uri uri = null;
            String melodyId = a != null ? a.optString("melodyId", "") : "";
            if (!melodyId.isEmpty() && !"null".equals(melodyId)) {
                File f = new File(getFilesDir(), "melodies/" + melodyId + ".audio");
                if (f.exists()) uri = Uri.fromFile(f);
            }
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            mp.setDataSource(this, uri);
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
            mp.setLooping(true);
            mp.prepare();
            mp.start();
        } catch (Exception e) { /* если звук не вышел — вибрация всё равно идёт */ }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            NotificationChannel ch = new NotificationChannel(CH, "Будильник", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(null, null);        // звук играет сам сервис
            ch.enableVibration(false);
            ch.setBypassDnd(true);
            nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification(String id) {
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;

        Intent full = new Intent(this, RingActivity.class);
        full.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent fullPi = PendingIntent.getActivity(this, 100, full, f);

        Intent stop = new Intent(this, RingService.class);
        stop.putExtra("action", "STOP"); stop.putExtra("id", id);
        PendingIntent stopPi = PendingIntent.getService(this, 101, stop, f);

        Intent sn = new Intent(this, RingService.class);
        sn.putExtra("action", "SNOOZE"); sn.putExtra("id", id);
        PendingIntent snPi = PendingIntent.getService(this, 102, sn, f);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CH)
                : new Notification.Builder(this);
        return b.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("диньдинь ⏰ " + currentTime)
                .setContentText(currentNote.isEmpty() ? "Будильник звонит!" : currentNote)
                .setCategory(Notification.CATEGORY_ALARM)
                .setOngoing(true)
                .setFullScreenIntent(fullPi, true)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Выключить", stopPi)
                .addAction(android.R.drawable.ic_popup_reminder, "Отложить 5 мин", snPi)
                .build();
    }

    public static void stop(Context c) { c.stopService(new Intent(c, RingService.class)); }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (mp != null) { try { mp.stop(); } catch (Exception ignored) {} mp.release(); mp = null; }
        if (vib != null) vib.cancel();
        if (wl != null && wl.isHeld()) wl.release();
        currentId = null;
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).cancel(NOTIF);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent i) { return null; }
}
