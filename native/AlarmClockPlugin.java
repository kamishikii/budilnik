package io.kamishikii.dindin;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "AlarmClock")
public class AlarmClockPlugin extends Plugin {

    
    @PluginMethod
    public void sync(PluginCall call) {
        String json = call.getString("alarms", "[]");
        String used = call.getString("melodyIds", "");
        SharedPreferences sp = AlarmScheduler.prefs(getContext());
        sp.edit().putString("list", json).putString("autoDisabled", "").apply();
        AlarmScheduler.rescheduleAll(getContext());

        
        Set<String> keep = new HashSet<>(Arrays.asList(used.split(",")));
        File dir = new File(getContext().getFilesDir(), "melodies");
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                String name = f.getName();
                String id = name.endsWith(".audio") ? name.substring(0, name.length() - 6) : name;
                if (!keep.contains(id)) f.delete();
            }
        }
        call.resolve();
    }

    
    @PluginMethod
    public void getState(PluginCall call) {
        String dis = AlarmScheduler.prefs(getContext()).getString("autoDisabled", "");
        JSArray arr = new JSArray();
        for (String s : dis.split(",")) if (!s.isEmpty()) arr.put(s);
        JSObject o = new JSObject();
        o.put("disabled", arr);
        call.resolve(o);
    }

    
    @PluginMethod
    public void saveMelody(PluginCall call) {
        String id = call.getString("id");
        String data = call.getString("data");
        if (id == null || data == null) { call.reject("no data"); return; }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            File dir = new File(getContext().getFilesDir(), "melodies");
            dir.mkdirs();
            FileOutputStream fos = new FileOutputStream(new File(dir, id + ".audio"));
            fos.write(bytes);
            fos.close();
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void stop(PluginCall call) { RingService.stop(getContext()); call.resolve(); }

    @PluginMethod
    public void snooze(PluginCall call) {
        String id = call.getString("id");
        int minutes = call.getInt("minutes", 5);
        if (id != null) AlarmScheduler.scheduleSnooze(getContext(), id, minutes);
        RingService.stop(getContext());
        call.resolve();
    }

    
    @PluginMethod
    public void askBattery(PluginCall call) {
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            }
        } catch (Exception ignored) {}
        call.resolve();
    }
}
