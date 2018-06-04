/*
 * Copyright (C) 2013 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.drx.trash.botcontroll.ui;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.bluetooth.BluetoothGattCharacteristic;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.PersistableBundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.view.MenuItem;
import android.view.View;
import android.widget.*;
import com.drx.trash.botcontroll.BotController;
import com.drx.trash.botcontroll.BotLog;
import com.drx.trash.botcontroll.SwitchBot;
import com.drx.trash.botcontroll.services.HandlePressService;
import com.drx.trash.botcontroll.services.ScheduleService;
import com.drx.trash.botcontroll.R;
import com.drx.trash.botcontroll.settings.Settings;

import java.util.*;

public class DeviceSetupActivity extends Activity {
    private final static String TAG = DeviceSetupActivity.class.getSimpleName();

    public static final String EXTRAS_DEVICE_NAME = "DEVICE_NAME";
    public static final String EXTRAS_DEVICE_ADDRESS = "DEVICE_ADDRESS";

    private String mDeviceName;
    private String mDeviceAddress;
    private ListView mLogList;
    private ArrayList<ArrayList<BluetoothGattCharacteristic>> mGattCharacteristics =
            new ArrayList<ArrayList<BluetoothGattCharacteristic>>();
    private Settings settings;

    private final String LIST_NAME = "NAME";
    private final String LIST_UUID = "UUID";



    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.device_setup);
        settings = new Settings(this);

        final Intent intent = getIntent();
        mDeviceName = intent.getStringExtra(EXTRAS_DEVICE_NAME);
        mDeviceAddress = intent.getStringExtra(EXTRAS_DEVICE_ADDRESS);

        // Sets up UI references.
        ((TextView) findViewById(R.id.device_address)).setText(mDeviceAddress);
        mLogList = (ListView) findViewById(R.id.log_list);


        Button btnPress = (Button)findViewById(R.id.setup_press);
        btnPress.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                final SwitchBot bot = new SwitchBot(mDeviceAddress, mDeviceName);
                BotController controller = BotController.createController( DeviceSetupActivity.this, bot, null);
                if (controller != null)
                    controller.press();
            }
        });

        Button btnRefresh = (Button)findViewById(R.id.setup_refresh_log);
        btnRefresh.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                updateLog(BotLog.getContents(DeviceSetupActivity.this));
            }
        });

        getActionBar().setTitle(mDeviceName);
        getActionBar().setDisplayHomeAsUpEnabled(true);

        EditText nameEditor = (EditText)findViewById(R.id.setup_edit_device_name);
        nameEditor.setText(mDeviceName);
        nameEditor.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {   }

            @Override
            public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {
                settings.setDeviceName(mDeviceAddress, charSequence.toString());
                mDeviceName = charSequence.toString();
            }

            @Override
            public void afterTextChanged(Editable editable) { }
        });

        CheckBox chkTimersEnabled = (CheckBox)findViewById(R.id.setup_enable_timers);
        chkTimersEnabled.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton compoundButton, boolean checked) {
                if (checked) { // reschedule job
                    //scheduleJobs();
                    scheduleTimers();
                } else { // cancel jobs
                    cancelJobs();
                    cancelTimers();
                }
            }
        });

        // schedule job
        if (chkTimersEnabled.isChecked())
            scheduleTimers();
    }

    private void scheduleJobs() {
        Log.i(TAG, "scheduling jobs...");
        ComponentName scheduleService = new ComponentName(this, ScheduleService.class);
        JobInfo.Builder builder = new JobInfo.Builder(0, scheduleService);
        builder.setPeriodic(5 * 60 * 1000); // job scheduled for 10 minutes

        PersistableBundle extras = new PersistableBundle();
        extras.putString(ScheduleService.EXTRA_ADDRESS, mDeviceAddress);
        extras.putString(ScheduleService.EXTRA_NAME, mDeviceName);
        builder.setExtras(extras);

        JobScheduler tm = (JobScheduler) getSystemService(Context.JOB_SCHEDULER_SERVICE);
        tm.schedule(builder.build());
    }

    private void cancelJobs() {
        Log.i(TAG, "stopping jobs...");
        JobScheduler tm = (JobScheduler) getSystemService(Context.JOB_SCHEDULER_SERVICE);
        tm.cancelAll();
    }

    private void scheduleTimers() {
        Log.i(TAG, "scheduling timers...");
        AlarmManager alarmMgr = (AlarmManager)getSystemService(Context.ALARM_SERVICE);
        Intent serviceIntent = new Intent(this, HandlePressService.class);
        serviceIntent.putExtra(HandlePressService.EXTRA_ADDRESS, mDeviceAddress);
        serviceIntent.putExtra(HandlePressService.EXTRA_NAME, mDeviceName);
        PendingIntent alarmIntent = PendingIntent.getService(this, 0, serviceIntent, 0);

        //Calendar calendar = Calendar.getInstance();

        alarmMgr.setRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis(),
                10 * 60 * 1000, alarmIntent);

        // start the Press Service
        startService(serviceIntent);
    }

    private void cancelTimers() {
        Log.i(TAG, "cancelling timers...");
        AlarmManager alarmMgr = (AlarmManager)getSystemService(Context.ALARM_SERVICE);
        Intent serviceIntent = new Intent(this, HandlePressService.class);
        PendingIntent alarmIntent = PendingIntent.getService(this, 0, serviceIntent, 0);
        alarmMgr.cancel(alarmIntent);

        // stop HandlePressService
        stopService(serviceIntent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateLog(BotLog.getContents(this));
    }

    @Override
    protected void onPause() {
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
    }


    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        switch(item.getItemId()) {
            case R.id.menu_connect:
                return true;
            case R.id.menu_disconnect:
                return true;
            case android.R.id.home:
                onBackPressed();
                return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void updateLog(List<String> logLines) {
        Collections.reverse(logLines);
        mLogList.setAdapter(new ArrayAdapter<>(this,  android.R.layout.simple_list_item_1, logLines));
    }

}
