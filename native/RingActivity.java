package io.kamishikii.dindin;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.Random;

public class RingActivity extends Activity {
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable check = new Runnable() {
        @Override public void run() {
            if (RingService.currentId == null) { finish(); return; }
            h.postDelayed(this, 500);
        }
    };
    private float downX = 0, downY = -1;
    private boolean downOnSnooze = false;
    private Button snooze;
    private ValueAnimator bob;

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

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF000000);
        root.addView(new Backdrop(this), new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        int pad = dp(24);
        col.setPadding(pad, 0, pad, 0);

        Typeface thin = Typeface.create("sans-serif-thin", Typeface.NORMAL);

        TextView time = new TextView(this);
        time.setText(RingService.currentTime);
        time.setTextSize(TypedValue.COMPLEX_UNIT_SP, 92);
        time.setTypeface(thin);
        time.setLetterSpacing(0.05f);
        time.setTextColor(0xFFEDF1F7);
        time.setGravity(Gravity.CENTER);
        time.setShadowLayer(28f, 0, 0, 0x59B9C2D8);
        LinearLayout.LayoutParams tl = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        tl.topMargin = dp(56);
        col.addView(time, tl);

        java.util.Calendar now = java.util.Calendar.getInstance();
        TextView date = new TextView(this);
        date.setText(String.format(java.util.Locale.US, "%02d.%02d.%04d",
                now.get(java.util.Calendar.DAY_OF_MONTH),
                now.get(java.util.Calendar.MONTH) + 1,
                now.get(java.util.Calendar.YEAR)));
        date.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        date.setTypeface(thin);
        date.setLetterSpacing(0.32f);
        date.setTextColor(0xFFBFC7D6);
        date.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams dl = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        dl.topMargin = dp(12);
        col.addView(date, dl);

        TextView note = new TextView(this);
        note.setText(RingService.currentNote);
        note.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        note.setTypeface(thin);
        note.setLetterSpacing(0.08f);
        note.setTextColor(0xFF8F97A8);
        note.setGravity(Gravity.CENTER);
        if (RingService.currentNote.isEmpty()) note.setVisibility(View.GONE);
        LinearLayout.LayoutParams nl = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        nl.topMargin = dp(8);
        col.addView(note, nl);

        View spacer = new View(this);
        col.addView(spacer, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        TextView arrow = new TextView(this);
        arrow.setText("↑");
        arrow.setTextSize(TypedValue.COMPLEX_UNIT_SP, 42);
        arrow.setTypeface(thin);
        arrow.setTextColor(0xFFD9DFEA);
        arrow.setAlpha(0.85f);
        arrow.setGravity(Gravity.CENTER);
        col.addView(arrow, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        bob = ValueAnimator.ofFloat(dp(4), -dp(7));
        bob.setDuration(1400);
        bob.setRepeatCount(ValueAnimator.INFINITE);
        bob.setRepeatMode(ValueAnimator.REVERSE);
        bob.addUpdateListener(a -> arrow.setTranslationY((Float) a.getAnimatedValue()));
        bob.start();

        snooze = new Button(this);
        snooze.setAllCaps(false);
        snooze.setBackground(null);
        snooze.setText("Отложить\nна 5 мин");
        snooze.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        snooze.setTypeface(thin);
        snooze.setLetterSpacing(0.06f);
        snooze.setTextColor(0xFFE8ECF4);
        snooze.setPadding(dp(30), dp(14), dp(30), dp(14));
        snooze.setOnClickListener(v -> {
            AlarmScheduler.scheduleSnooze(this, id, 5);
            RingService.stop(this);
            finish();
        });
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sl.topMargin = dp(10);
        sl.bottomMargin = dp(40);
        col.addView(snooze, sl);

        root.addView(col, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        hideSystemBars();
        h.postDelayed(check, 500);
    }

    // ===== полностью убираем строку состояния и навигацию на время звонка =====
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController ic = getWindow().getInsetsController();
            if (ic != null) {
                ic.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                ic.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override protected void onResume() {
        super.onResume();
        hideSystemBars();
    }

    // смахивание вверх в любом месте, КРОМЕ кнопки «Отложить», выключает будильник
    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        switch (ev.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                downX = ev.getRawX(); downY = ev.getRawY();
                downOnSnooze = false;
                if (snooze != null) {
                    int[] loc = new int[2];
                    snooze.getLocationOnScreen(loc);
                    downOnSnooze = downX >= loc[0] && downX <= loc[0] + snooze.getWidth()
                            && downY >= loc[1] && downY <= loc[1] + snooze.getHeight();
                }
                break;
            case MotionEvent.ACTION_UP:
                float dy = downY - ev.getRawY();
                if (!downOnSnooze && downY >= 0 && dy > dp(70)
                        && Math.abs(ev.getRawX() - downX) < dy) {
                    downY = -1;
                    RingService.stop(this);
                    finish();
                    return true;
                }
                downY = -1;
                break;
            case MotionEvent.ACTION_CANCEL:
                downY = -1;
                break;
        }
        return super.dispatchTouchEvent(ev);
    }

    private int dp(int v) { return Math.round(getResources().getDisplayMetrics().density * v); }

    @Override public void onBackPressed() { /* случайно не закрываем */ }

    @Override protected void onDestroy() {
        if (bob != null) bob.cancel();
        h.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    // ===== чёрный фон: пульсирующее свечение по краям + дрейфующие светлячки =====
    private static class Fly {
        float fx, fy, r, a, sp, sp2, tw, ph, ph2, ph3;
        boolean center;
    }

    private class Backdrop extends View {
        private final Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG);
        private Shader left, right, top, bottom;
        private final Fly[] flies = new Fly[260];
        private boolean running = false;
        private long t0 = SystemClock.uptimeMillis();
        private int w, hh;

        Backdrop(Context c) {
            super(c);
            Random rnd = new Random(7);
            dot.setColor(0xFFE6F4EE);
            for (int i = 0; i < flies.length; i++) {
                Fly f = new Fly();
                float z = rnd.nextFloat();
                if (z < 0.62f) {           // плотные боковые полосы
                    f.fx = rnd.nextFloat() < 0.5f ? rnd.nextFloat() * 0.20f : 0.80f + rnd.nextFloat() * 0.20f;
                    f.fy = rnd.nextFloat();
                } else if (z < 0.82f) {    // верх и низ
                    f.fx = rnd.nextFloat();
                    f.fy = rnd.nextFloat() < 0.5f ? rnd.nextFloat() * 0.16f : 0.84f + rnd.nextFloat() * 0.16f;
                } else {                   // редкие точки в центре
                    f.fx = 0.2f + rnd.nextFloat() * 0.6f;
                    f.fy = 0.2f + rnd.nextFloat() * 0.6f;
                    f.center = true;
                }
                f.r = 0.6f + rnd.nextFloat() * 1.6f;
                f.a = 0.25f + rnd.nextFloat() * 0.75f;
                f.sp = 0.25f + rnd.nextFloat() * 0.5f;
                f.sp2 = 0.2f + rnd.nextFloat() * 0.45f;
                f.tw = 0.6f + rnd.nextFloat() * 1.8f;
                f.ph = rnd.nextFloat() * 6.28f;
                f.ph2 = rnd.nextFloat() * 6.28f;
                f.ph3 = rnd.nextFloat() * 6.28f;
                flies[i] = f;
            }
        }

        @Override protected void onSizeChanged(int nw, int nh, int ow, int oh) {
            w = nw; hh = nh;
            int col = 0xFFB9C2D8;
            left = new LinearGradient(0, 0, w * 0.30f, 0, col, col & 0x00FFFFFF, Shader.TileMode.CLAMP);
            right = new LinearGradient(w, 0, w * 0.70f, 0, col, col & 0x00FFFFFF, Shader.TileMode.CLAMP);
            top = new LinearGradient(0, 0, 0, hh * 0.22f, col, col & 0x00FFFFFF, Shader.TileMode.CLAMP);
            bottom = new LinearGradient(0, hh, 0, hh * 0.78f, col, col & 0x00FFFFFF, Shader.TileMode.CLAMP);
        }

        @Override protected void onAttachedToWindow() {
            super.onAttachedToWindow();
            running = true;
            t0 = SystemClock.uptimeMillis();
            postInvalidateOnAnimation();
        }

        @Override protected void onDetachedFromWindow() {
            running = false;
            super.onDetachedFromWindow();
        }

        @Override protected void onDraw(Canvas c) {
            super.onDraw(c);
            if (w == 0 || hh == 0) return;
            float t = (SystemClock.uptimeMillis() - t0) / 1000f;
            c.drawColor(0xFF000000);

            float pulse = 0.72f + 0.16f * (float) Math.sin(t * 0.7) + 0.12f * (float) Math.sin(t * 1.31 + 1.7);
            glow.setAlpha(Math.max(0, Math.min(255, Math.round(200 * pulse))));
            glow.setShader(left);   c.drawRect(0, 0, w * 0.30f, hh, glow);
            glow.setShader(right);  c.drawRect(w * 0.70f, 0, w, hh, glow);
            glow.setShader(top);    c.drawRect(0, 0, w, hh * 0.22f, glow);
            glow.setShader(bottom); c.drawRect(0, hh * 0.78f, w, hh, glow);
            glow.setShader(null);

            float d = getResources().getDisplayMetrics().density;
            for (Fly f : flies) {
                float x = f.fx * w + (float) Math.sin(t * f.sp + f.ph) * 6 * d;
                float y = f.fy * hh + (float) Math.cos(t * f.sp2 + f.ph2) * 5 * d;
                float tw = 0.3f + 0.7f * (0.5f + 0.5f * (float) Math.sin(t * f.tw + f.ph3));
                dot.setAlpha(Math.max(0, Math.min(255, Math.round(255 * f.a * tw * (f.center ? 0.45f : 1f)))));
                c.drawCircle(x, y, f.r * d, dot);
            }
            if (running) postInvalidateOnAnimation();
        }
    }
}
