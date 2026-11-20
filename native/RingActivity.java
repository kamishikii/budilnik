package io.kamishikii.dindin;

import android.app.Activity;
import android.app.KeyguardManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class RingActivity extends Activity {
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable check = new Runnable() {
        @Override public void run() {
            if (RingService.currentId == null) { finish(); return; }
            h.postDelayed(this, 500);
        }
    };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        final String id = RingService.currentId;
        if (id == null) { finish(); return; }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(0xFFF6F7F5);
        int pad = dp(24);
        root.setPadding(pad, pad, pad, pad);

        TextView time = new TextView(this);
        time.setText(RingService.currentTime);
        time.setTextSize(TypedValue.COMPLEX_UNIT_SP, 72);
        time.setTypeface(Typeface.DEFAULT_BOLD);
        time.setTextColor(0xFF3A3A3A);
        time.setGravity(Gravity.CENTER);
        root.addView(time);

        TextView note = new TextView(this);
        note.setText(RingService.currentNote);
        note.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        note.setTextColor(0xFF3A3A3A);
        note.setGravity(Gravity.CENTER);
        note.setPadding(0, dp(8), 0, dp(32));
        root.addView(note);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);

        Button snooze = new Button(this);
        snooze.setText("Отложить\n5 мин");
        snooze.setTextSize(16);
        snooze.setOnClickListener(v -> {
            AlarmScheduler.scheduleSnooze(this, id, 5);
            RingService.stop(this);
            finish();
        });
        row.addView(snooze);

        Button stop = new Button(this);
        stop.setText("Выключить");
        stop.setTextSize(16);
        stop.setTypeface(Typeface.DEFAULT_BOLD);
        stop.setBackgroundColor(0xFF7FAE95);
        stop.setTextColor(Color.WHITE);
        stop.setOnClickListener(v -> { RingService.stop(this); finish(); });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.leftMargin = dp(16);
        stop.setLayoutParams(lp);
        row.addView(stop);

        root.addView(row);
        setContentView(root);
        h.postDelayed(check, 500);
    }

    private int dp(int v) { return Math.round(getResources().getDisplayMetrics().density * v); }

    @Override public void onBackPressed() { /* случайно не закрываем */ }

    @Override protected void onDestroy() { h.removeCallbacksAndMessages(null); super.onDestroy(); }
}
