package io.kamishikii.dindin;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String id = i.getStringExtra("id");
        if (id == null) return;
        boolean snooze = i.getBooleanExtra("snooze", false);
        AlarmScheduler.afterFire(c, id, snooze); // сразу планируем следующий раз
        Intent s = new Intent(c, RingService.class);
        s.putExtra("id", id);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(s);
        else c.startService(s);
    }
}
