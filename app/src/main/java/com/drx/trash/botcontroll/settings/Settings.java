package com.drx.trash.botcontroll.settings;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * @author Botond Xantus
 */
public class Settings {
    private static final String DEVICE_PREFERENCES = "com.drx.trash.botcontroll.devices";

    public Settings(Context ctx) {
        this.ctx = ctx;
    }

    private Context ctx;

    public String getDeviceName(String address, String defaultName) {
        return getDevicePreferences().getString(address, defaultName);
    }

    public void setDeviceName(String address, String newName) {
        SharedPreferences devicePrefs = getDevicePreferences();
        SharedPreferences.Editor editor = devicePrefs.edit();
        editor.putString(address, newName);
        editor.apply();
    }

    private SharedPreferences getDevicePreferences() {
        return ctx.getSharedPreferences(DEVICE_PREFERENCES, Context.MODE_PRIVATE);
    }
}
