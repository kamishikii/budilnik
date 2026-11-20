package io.kamishikii.dindin;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

public class AlarmScheduler {

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("dindin", Context.MODE_PRIVATE);
    }

    static JSONArray alarms(Context c) {
        try { return new JSONArray(prefs(c).getString("list", "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }

    static JSONObject find(Context c, String id) {
        JSONArray arr = alarms(c);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject a = arr.optJSONObject(i);
            if (a != null && id.equals(a.optString("id"))) return a;
        }
        return null;
    }

    static int req(String id) { return id.hashCode(); }

    static int piFlags() {
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return f;
    }

    static PendingIntent pi(Context c, String id, boolean snooze) {
        Intent i = new Intent(c, AlarmReceiver.class);
        i.putExtra("id", id);
        i.putExtra("snooze", snooze);
        return PendingIntent.getBroadcast(c, req(id), i, piFlags());
    }

    static void cancel(Context c, String id) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        am.cancel(pi(c, id, false));
    }

    static void schedule(Context c, String id, long time, boolean snooze) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent p = pi(c, id, snooze);
        am.cancel(p);
        try {
            boolean exactOk = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
            if (Build.VERSION.SDK_INT >= 23 && exactOk) {
                if (!snooze) {
                    // setAlarmClock — режим настоящего будильника: система будит даже в глубоком сне
                    Intent show = new Intent(c, MainActivity.class);
                    PendingIntent showPi = PendingIntent.getActivity(c, req(id) ^ 0x5555, show, piFlags());
                    am.setAlarmClock(new AlarmManager.AlarmClockInfo(time, showPi), p);
                } else {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, p);
                }
            } else if (Build.VERSION.SDK_INT >= 23) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, p);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, time, p);
            }
        } catch (SecurityException e) {
            am.set(AlarmManager.RTC_WAKEUP, time, p);
        }
    }

    // перерегистрировать всё (вызывается при синхронизации, после перезагрузки, после обновления)
    public static void rescheduleAll(Context c) {
        JSONArray arr = alarms(c);
        long now = System.currentTimeMillis();
        SharedPreferences sp = prefs(c);
        Set<String> old = new HashSet<>(sp.getStringSet("scheduled", new HashSet<String>()));
        Set<String> current = new HashSet<>();

        for (int i = 0; i < arr.length(); i++) {
            JSONObject a = arr.optJSONObject(i);
            if (a == null) continue;
            String id = a.optString("id");
            current.add(id);
            cancel(c, id);
            if (!a.optBoolean("enabled")) { sp.edit().remove("snooze." + id).apply(); continue; }
            long sn = sp.getLong("snooze." + id, 0);
            if (sn > now) { schedule(c, id, sn, true); continue; }
            sp.edit().remove("snooze." + id).apply();
            long t = nextTrigger(a, now);
            if (t > 0) schedule(c, id, t, false);
        }
        // будильники, которых больше нет в списке
        for (String id : old) {
            if (!current.contains(id)) { cancel(c, id); sp.edit().remove("snooze." + id).apply(); }
        }
        sp.edit().putStringSet("scheduled", current).apply();
    }

    // после звонка: запланировать следующий раз (или выключить «однократно»)
    public static void afterFire(Context c, String id, boolean snooze) {
        SharedPreferences sp = prefs(c);
        if (snooze) sp.edit().remove("snooze." + id).apply();
        JSONObject a = find(c, id);
        if (a == null || !a.optBoolean("enabled")) return;

        JSONObject s = a.optJSONObject("schedule");
        String type = s == null ? "once" : s.optString("type", "once");
        if (!snooze && "once".equals(type)) {
            JSONArray arr = alarms(c);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject x = arr.optJSONObject(i);
                if (x != null && id.equals(x.optString("id"))) {
                    try { x.put("enabled", false); } catch (Exception ignored) {}
                }
            }
            String dis = sp.getString("autoDisabled", "");
            sp.edit().putString("list", arr.toString())
                     .putString("autoDisabled", dis + id + ",").apply();
            return;
        }
        long t = nextTrigger(a, System.currentTimeMillis() + 60000);
        if (t > 0) schedule(c, id, t, false);
    }

    public static void scheduleSnooze(Context c, String id, int minutes) {
        long t = System.currentTimeMillis() + minutes * 60000L;
        prefs(c).edit().putLong("snooze." + id, t).apply();
        schedule(c, id, t, true);
    }

    // ближайшее срабатывание после момента from
    static long nextTrigger(JSONObject a, long from) {
        try {
            String[] hm = a.optString("time", "00:00").split(":");
            int h = Integer.parseInt(hm[0]), m = Integer.parseInt(hm[1]);
            JSONObject s = a.optJSONObject("schedule");
            String type = s == null ? "once" : s.optString("type", "once");

            if ("custom".equals(type)) {
                long best = 0;
                JSONArray dates = s.optJSONArray("dates");
                if (dates == null) return 0;
                for (int i = 0; i < dates.length(); i++) {
                    String[] p = dates.optString(i).split("-");
                    if (p.length != 3) continue;
                    Calendar d = Calendar.getInstance();
                    d.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]), h, m, 0);
                    d.set(Calendar.MILLISECOND, 0);
                    long t = d.getTimeInMillis();
                    if (t > from && (best == 0 || t < best)) best = t;
                }
                return best;
            }

            Calendar d = Calendar.getInstance();
            d.setTimeInMillis(from);
            d.set(Calendar.HOUR_OF_DAY, h);
            d.set(Calendar.MINUTE, m);
            d.set(Calendar.SECOND, 0);
            d.set(Calendar.MILLISECOND, 0);
            if (d.getTimeInMillis() <= from) d.add(Calendar.DAY_OF_YEAR, 1);

            int work = 0, rest = 0;
            if ("1/1".equals(type)) { work = 1; rest = 1; }
            else if ("2/2".equals(type)) { work = 2; rest = 2; }
            else if ("3/3".equals(type)) { work = 3; rest = 3; }
            else if ("4/4".equals(type)) { work = 4; rest = 4; }
            else if ("5/2".equals(type)) { work = 5; rest = 2; }
            else if ("6/1".equals(type)) { work = 6; rest = 1; }

            for (int k = 0; k < 8; k++) {
                if (activeOn(type, s, d, work, rest)) return d.getTimeInMillis();
                d.add(Calendar.DAY_OF_YEAR, 1);
            }
            return 0;
        } catch (Exception e) { return 0; }
    }

    static boolean activeOn(String type, JSONObject s, Calendar d, int work, int rest) {
        int dow = d.get(Calendar.DAY_OF_WEEK);
        if ("weekdays".equals(type)) return dow >= Calendar.MONDAY && dow <= Calendar.FRIDAY;
        if ("weekends".equals(type)) return dow == Calendar.SATURDAY || dow == Calendar.SUNDAY;
        if (work > 0) {
            String[] p = s.optString("anchor", "").split("-");
            Calendar a = Calendar.getInstance();
            if (p.length == 3) a.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]));
            a.set(Calendar.HOUR_OF_DAY, 0); a.set(Calendar.MINUTE, 0);
            a.set(Calendar.SECOND, 0); a.set(Calendar.MILLISECOND, 0);
            Calendar b = (Calendar) d.clone();
            b.set(Calendar.HOUR_OF_DAY, 0); b.set(Calendar.MINUTE, 0);
            b.set(Calendar.SECOND, 0); b.set(Calendar.MILLISECOND, 0);
            long diff = Math.round((b.getTimeInMillis() - a.getTimeInMillis()) / 86400000.0);
            int total = work + rest;
            int pos = (int) (((diff % total) + total) % total);
            return pos < work;
        }
        return true; // once, daily
    }
              }
